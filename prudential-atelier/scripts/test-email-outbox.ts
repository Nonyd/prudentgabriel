/**
 * Email outbox: idempotency, retry vs terminal, concurrent claim, circuit breaker.
 *
 *   pnpm test:email-outbox
 */
import "./preload-test-env";
import { EmailStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  isEmailProviderCircuitOpen,
  recordEmailProviderFailure,
  resetEmailCircuitBreakers,
} from "../src/lib/email-circuit-breaker";
import { setEmailProvidersForTest, type EmailProvider } from "../src/lib/email-providers";
import {
  deliverEmail,
  queueEmail,
  setSkipImmediateDeliverForTest,
} from "../src/lib/email-outbox";
import type { EmailError } from "../src/lib/email-outbox-types";
import { nextBackoffMs } from "../src/lib/email-outbox-types";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const prefix = `test-e-outbox-${Date.now()}`;
const ids: string[] = [];

function provider(
  name: string,
  send: EmailProvider["send"],
  configured = true,
): EmailProvider {
  return { name, send, isConfigured: () => configured };
}

async function queue(key: string, extra?: { html?: string }) {
  const row = await queueEmail({
    to: "client@example.test",
    fromAddress: '"Test" <noreply@example.test>',
    subject: "Outbox test",
    html: extra?.html ?? "<p>hi</p>",
    template: "test",
    idempotencyKey: `${prefix}:${key}`,
  });
  if (row.id) ids.push(row.id);
  return row;
}

async function cleanup() {
  if (ids.length) {
    await prisma.emailMessage.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.emailMessage.deleteMany({
    where: { idempotencyKey: { startsWith: prefix } },
  });
  await prisma.adminNotification.deleteMany({
    where: { type: { in: ["EMAIL_DEAD", "EMAIL_PROVIDER_AUTH"] }, message: { contains: "example.test" } },
  });
}

async function main() {
  setSkipImmediateDeliverForTest(true);
  resetEmailCircuitBreakers();

  const a = await queue("idem");
  const b = await queue("idem");
  assert(a.created, "first insert creates");
  assert(!b.created, "duplicate idempotency key is a no-op");
  assert(a.id === b.id, "same row returned");
  const count = await prisma.emailMessage.count({ where: { idempotencyKey: `${prefix}:idem` } });
  assert(count === 1, "one row for duplicate key");

  setEmailProvidersForTest([]);
  const none = await queue("noprovider");
  await deliverEmail(none.id);
  const dead = await prisma.emailMessage.findUnique({ where: { id: none.id } });
  assert(dead?.status === EmailStatus.DEAD, "no provider → DEAD");
  assert(dead?.lastError === "no provider configured", "clear error when unconfigured");

  let secondCalls = 0;
  const terminal = provider("bad", async () => ({
    error: { kind: "terminal", message: "invalid recipient", status: 400 } satisfies EmailError,
  }));
  const backup = provider("ok", async () => {
    secondCalls += 1;
    return { id: "should-not-run" };
  });
  setEmailProvidersForTest([terminal, backup]);
  resetEmailCircuitBreakers();
  const four = await queue("http400");
  await deliverEmail(four.id);
  const fourRow = await prisma.emailMessage.findUnique({ where: { id: four.id } });
  assert(fourRow?.status === EmailStatus.DEAD, "400 → DEAD");
  assert(secondCalls === 0, "400 does not try the next provider");

  let retryCalls = 0;
  setEmailProvidersForTest([
    provider("flaky", async () => {
      retryCalls += 1;
      return { error: { kind: "retryable", message: "upstream 500", status: 500 } };
    }),
  ]);
  resetEmailCircuitBreakers();
  const five = await queue("http500");
  const before = Date.now();
  await deliverEmail(five.id);
  const fiveRow = await prisma.emailMessage.findUnique({ where: { id: five.id } });
  assert(fiveRow?.status === EmailStatus.FAILED, "500 → FAILED (retry)");
  assert(retryCalls === 1, "one send attempt");
  const wait = fiveRow!.nextAttemptAt!.getTime() - before;
  assert(wait >= nextBackoffMs(1) - 2_000, "backoff ~1 minute");
  assert(wait <= nextBackoffMs(1) + 5_000, "backoff not unbounded");

  let sendStarts = 0;
  setEmailProvidersForTest([
    provider("slow", async () => {
      sendStarts += 1;
      await new Promise((r) => setTimeout(r, 80));
      return { id: "once" };
    }),
  ]);
  resetEmailCircuitBreakers();
  const race = await queue("race");
  await Promise.all([deliverEmail(race.id), deliverEmail(race.id)]);
  const raceRow = await prisma.emailMessage.findUnique({ where: { id: race.id } });
  assert(sendStarts === 1, "concurrent drains send once");
  assert(raceRow?.status === EmailStatus.SENT, "winner marks SENT");
  assert(raceRow?.provider === "slow", "provider recorded");

  resetEmailCircuitBreakers();
  for (let i = 0; i < 3; i += 1) recordEmailProviderFailure("resend");
  assert(isEmailProviderCircuitOpen("resend"), "open after 3 failures");
  let skipped = 0;
  let probed = 0;
  setEmailProvidersForTest([
    provider("resend", async () => {
      probed += 1;
      return { id: "nope" };
    }),
    provider("smtp", async () => {
      skipped += 1;
      return { id: "smtp-ok" };
    }),
  ]);
  const cb = await queue("circuit");
  await deliverEmail(cb.id);
  assert(probed === 0, "open circuit skips Resend");
  assert(skipped === 1, "falls through to SMTP");
  const cbRow = await prisma.emailMessage.findUnique({ where: { id: cb.id } });
  assert(cbRow?.provider === "smtp", "delivered by backup");

  console.log("OK — email outbox");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    setEmailProvidersForTest(null);
    setSkipImmediateDeliverForTest(false);
    resetEmailCircuitBreakers();
    await cleanup().catch(() => undefined);
    await prisma.$disconnect();
  });
