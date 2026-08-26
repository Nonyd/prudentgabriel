/**
 * Slice I: abandoned checkout recovery + marketing unsub gate.
 *
 *   pnpm test:slice-i
 */
import "./preload-test-env";
import { render } from "@react-email/render";
import React from "react";
import { prisma } from "../src/lib/prisma";
import {
  sendAbandonedCheckoutReminder,
  parseCartSnapshot,
  MAX_AUTOMATIC_REMINDERS,
} from "../src/lib/checkout-session";
import { setSkipImmediateDeliverForTest } from "../src/lib/email-outbox";
import { getCapturedEmails, isEmailCaptureEnabled, clearCapturedEmails } from "../src/lib/email-capture";
import AbandonedCheckoutEmail from "../src/emails/AbandonedCheckoutEmail";
import PasswordResetEmail from "../src/emails/PasswordResetEmail";
import ReviewRequestEmail from "../src/emails/ReviewRequestEmail";
import { UNSUBSCRIBE_URL_PLACEHOLDER } from "../src/lib/email-priority";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const stamp = `slice-i-${Date.now()}`;
const sessionIds: string[] = [];
const prefEmails: string[] = [];

function snapshot(variantId = `missing-var-${stamp}`) {
  return {
    lines: [
      {
        productId: `prod-${stamp}`,
        productName: "Evening column",
        productSlug: "evening-column",
        variantId,
        size: "M",
        imageUrl: "",
        priceNGN: 250000,
        quantity: 1,
      },
    ],
    subtotalNGN: 250000,
  };
}

async function makeSession(extra?: {
  email?: string;
  recoveredAt?: Date | null;
  remindersSent?: number;
  variantId?: string;
}) {
  const email = extra?.email ?? `${stamp}-${Math.random().toString(16).slice(2)}@example.test`;
  const row = await prisma.checkoutSession.create({
    data: {
      email,
      cartSnapshot: snapshot(extra?.variantId),
      currency: "NGN",
      furthestStep: 2,
      lastActiveAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      recoveredAt: extra?.recoveredAt ?? null,
      remindersSent: extra?.remindersSent ?? 0,
    },
  });
  sessionIds.push(row.id);
  return row;
}

async function cleanup() {
  if (sessionIds.length) {
    await prisma.checkoutSession.deleteMany({ where: { id: { in: sessionIds } } });
  }
  await prisma.emailMessage.deleteMany({
    where: { idempotencyKey: { startsWith: "abandoned-checkout:" } , relatedId: { in: sessionIds } },
  });
  if (prefEmails.length) {
    await prisma.emailPreference.deleteMany({ where: { email: { in: prefEmails } } });
  }
}

async function main() {
  setSkipImmediateDeliverForTest(true);
  process.env.E2E_CAPTURE_EMAIL = "1";
  clearCapturedEmails();

  const parsed = parseCartSnapshot(snapshot());
  assert(parsed.lines.length === 1 && parsed.subtotalNGN === 250000, "snapshot parse");

  const recovered = await makeSession({ recoveredAt: new Date() });
  const recoveredSend = await sendAbandonedCheckoutReminder({ sessionId: recovered.id, kind: 1 });
  assert(!recoveredSend.queued && recoveredSend.reason === "recovered", "recovered session stops reminding");

  const unsubEmail = `${stamp}-unsub@example.test`;
  prefEmails.push(unsubEmail);
  await prisma.emailPreference.create({
    data: { email: unsubEmail, unsubscribedAt: new Date() },
  });
  const unsubSession = await makeSession({ email: unsubEmail });
  const unsubSend = await sendAbandonedCheckoutReminder({ sessionId: unsubSession.id, kind: 1 });
  assert(!unsubSend.queued && unsubSend.reason === "unsubscribed", "unsubscribed address skipped");

  const capped = await makeSession({ remindersSent: MAX_AUTOMATIC_REMINDERS });
  const manual = await sendAbandonedCheckoutReminder({ sessionId: capped.id, kind: "manual" });
  assert(!manual.queued && manual.reason === "automatic_cap", "manual send after two automatics blocked");

  const oos = await makeSession({ variantId: `ghost-variant-${stamp}` });
  const oosSend = await sendAbandonedCheckoutReminder({ sessionId: oos.id, kind: 1 });
  assert(!oosSend.queued && oosSend.reason === "out_of_stock", "all items out of stock skipped");

  const txHtml = await render(
    React.createElement(PasswordResetEmail, { resetUrl: "https://example.test/reset" }),
  );
  const relHtml = await render(
    React.createElement(ReviewRequestEmail, {
      firstName: "Amara",
      headline: "How was the piece?",
      bodyParagraph: "A short note when you have a moment.",
      ctaLabel: "Leave a review",
      ctaUrl: "https://example.test/review",
    }),
  );
  const mktHtml = await render(
    React.createElement(AbandonedCheckoutEmail, {
      firstName: "Amara",
      restoreUrl: "https://example.test/checkout/restore/token",
      lines: [{ name: "Evening column", quantity: 1, size: "M", priceLabel: "₦250,000" }],
    }),
  );

  assert(txHtml.includes("Reset password") && txHtml.includes("role=\"presentation\""), "transactional shell tables");
  assert(!txHtml.toLowerCase().includes("unsubscribe"), "transactional has no unsub");
  assert(relHtml.includes("Leave a review") && relHtml.includes("#442913"), "relationship family renders");
  assert(mktHtml.includes(UNSUBSCRIBE_URL_PLACEHOLDER), "marketing footer has unsub placeholder");
  assert(mktHtml.includes("Return to your bag"), "marketing CTA present");
  assert(!mktHtml.includes("display:flex") && !mktHtml.includes("display:grid"), "no flex/grid in marketing html");

  assert(isEmailCaptureEnabled(), "E2E_CAPTURE_EMAIL still on");
  getCapturedEmails();

  await cleanup();
  console.log("OK — slice I recovery skips + email families");
}

main()
  .catch(async (e) => {
    console.error(e);
    await cleanup().catch(() => {});
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
