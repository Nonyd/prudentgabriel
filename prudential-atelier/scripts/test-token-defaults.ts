/**
 * Slice AZ3 follow-up, made a rule by the token sweep: every column that opens
 * something from a link is on src/lib/capability-registry.ts, stores only a
 * hash, and can never default to a guessable value. A row created without a
 * token gets a random SHA-256-shaped value that opens no link.
 *
 *   pnpm test:token-defaults     # schema check always; DB check when reachable
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BespokeStage, OrderStatus, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { findOrderByTrackingToken } from "../src/lib/capability-token-lookup";
import { generateCapabilityToken } from "../src/lib/capability-token";
import { generateBespokeOrderRef } from "../src/lib/bespoke-stages";
import { looksLikeProductionDatabase, looksLikeStagingDatabase } from "./fixture-guard";
import { CAPABILITY_COLUMNS, NOT_CAPABILITY_COLUMNS } from "../src/lib/capability-registry";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

/** model -> field -> declaration line */
function parseSchema(): Map<string, Map<string, string>> {
  const s = readFileSync(path.join(__dirname, "..", "prisma/schema.prisma"), "utf8").replace(/\r\n/g, "\n");
  const models = new Map<string, Map<string, string>>();
  for (const m of Array.from(s.matchAll(/^model (\w+) \{\n([\s\S]*?)^\}/gm))) {
    const fields = new Map<string, string>();
    for (const line of m[2].split("\n")) {
      const t = line.trim();
      const f = /^(\w+)\s+\S+/.exec(t);
      if (f && !t.startsWith("//") && !t.startsWith("@@")) fields.set(f[1], t);
    }
    models.set(m[1], fields);
  }
  return models;
}

function schema() {
  const models = parseSchema();
  const listed = new Set(CAPABILITY_COLUMNS.map((c) => `${c.model}.${c.column}`));

  // The rule: a token-named String column is on the registry, or says why not.
  for (const [model, fields] of Array.from(models)) {
    for (const [name, line] of Array.from(fields)) {
      if (!/token/i.test(name) || !/^\w+\s+String/.test(line) || /(Enc|ExpiresAt)$/.test(name)) continue;
      const key = `${model}.${name}`;
      assert(listed.has(key) || key in NOT_CAPABILITY_COLUMNS, `${key} is on capability-registry.ts (or NOT_CAPABILITY_COLUMNS says why not)`);
    }
  }

  for (const c of CAPABILITY_COLUMNS) {
    const fields = models.get(c.model);
    const line = fields?.get(c.column);
    assert(fields && line, `${c.model}.${c.column} exists`);
    assert(!/cuid\(\)|nanoid|autoincrement|[^_]uuid\(\)/.test(line), `no guessable default: ${line}`);
    if (line.includes("@default")) assert(line.includes("gen_random_uuid()") && line.includes("sha256"), `random hash default: ${line}`);
    if (c.enc) assert(fields.has(c.enc), `${c.model}.${c.enc} exists`);
    if (c.expires) assert(fields.has(c.expires), `${c.model}.${c.expires} exists`);
    else assert(c.noExpiryReason, `${c.model}.${c.column} expires, or says why it cannot`);
  }
  console.log(`ok schema: ${CAPABILITY_COLUMNS.length} capability columns on the registry, none with a guessable default; every other token-named column explained`);
}

/** Nothing opens from a plaintext value: every stored token is a SHA-256. */
async function atRest() {
  for (const c of CAPABILITY_COLUMNS) {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM "${c.model}" WHERE "${c.column}" !~ '^[0-9a-f]{64}$'`,
    );
    assert(rows[0].n === BigInt(0), `${c.model}.${c.column}: ${rows[0].n} rows still plaintext (run scripts/upgrade-capability-tokens.ts)`);
  }
  console.log("ok at rest: every capability column holds only hashes");
}

async function database() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    console.log("skip database check: unreachable");
    return;
  }
  assert(!looksLikeProductionDatabase() && !looksLikeStagingDatabase(), "never against production or staging");
  await atRest();
  const email = `az3b-${Date.now()}@example.test`;
  const user = await prisma.user.create({ data: { email, name: "AZ3b", role: Role.CUSTOMER, password: "x" } });
  const profile = await prisma.clientProfile.create({ data: { userId: user.id } });
  // Created WITHOUT trackingToken / receiptConfirmToken, as seeds and tests do.
  const bare = await prisma.bespokeOrder.create({
    data: {
      orderRef: generateBespokeOrderRef(),
      clientProfileId: profile.id,
      clientName: "AZ3b",
      clientEmail: email,
      currentStage: BespokeStage.CONSULTATION_SESSION,
      status: OrderStatus.PROCESSING,
      totalAmount: 1,
      balance: 1,
    },
  });
  const issued = generateCapabilityToken();
  const real = await prisma.bespokeOrder.create({
    data: {
      orderRef: generateBespokeOrderRef(),
      clientProfileId: profile.id,
      clientName: "AZ3b",
      clientEmail: email,
      currentStage: BespokeStage.CONSULTATION_SESSION,
      status: OrderStatus.PROCESSING,
      totalAmount: 1,
      balance: 1,
      trackingToken: issued.hash,
      trackingTokenEnc: issued.enc,
    },
  });
  try {
    for (const v of [bare.trackingToken, bare.receiptConfirmToken]) {
      assert(/^[0-9a-f]{64}$/.test(v), `default is a 64-hex random value, not a cuid (${v})`);
    }
    assert(bare.trackingToken !== bare.receiptConfirmToken, "each default is independently random");
    assert(!(await findOrderByTrackingToken(bare.trackingToken)).ok, "the stored default opens no link");
    assert((await findOrderByTrackingToken(issued.raw)).ok, "an issued token still works");
  } finally {
    await prisma.bespokeOrder.deleteMany({ where: { id: { in: [bare.id, real.id] } } });
    await prisma.clientProfile.delete({ where: { id: profile.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  console.log("ok database: a row created without a token has no working, guessable link");
}

async function main() {
  schema();
  await database();
  console.log("OK test-token-defaults");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
