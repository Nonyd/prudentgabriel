/**
 * Slice AZ3 follow-up: a capability-token column can never default to a
 * guessable value. A row created without a token gets a random SHA-256-shaped
 * value that opens no link.
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

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function schema() {
  const s = readFileSync(path.join(__dirname, "..", "prisma/schema.prisma"), "utf8");
  const cols = s.match(/^\s*(publicToken|trackingToken|receiptConfirmToken|approvalToken)\s+String[^\n]*$/gm) ?? [];
  // BA2 added ConsultationEnquiry.publicToken (the booking link); BA5 ChatConversation.publicToken.
  assert(cols.length === 7, `seven token columns found (${cols.length})`);
  for (const c of cols) {
    assert(!c.includes("cuid()"), `no cuid default: ${c.trim()}`);
    assert(c.includes("gen_random_uuid()"), `random database default: ${c.trim()}`);
  }
  console.log("ok schema: no token column defaults to cuid()");
}

async function database() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    console.log("skip database check: unreachable");
    return;
  }
  assert(!looksLikeProductionDatabase() && !looksLikeStagingDatabase(), "never against production or staging");
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
