/**
 * One-off, idempotent: every commission with confirmed money but no client
 * profile gets one (account + profile + link), as payments now do on their own.
 *
 *   npx tsx --env-file=.env scripts/backfill-commission-clients.ts          # dry run
 *   npx tsx --env-file=.env scripts/backfill-commission-clients.ts --apply
 */
import { PaymentStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { autoOnboardClient } from "../src/lib/client-onboarding";

async function main() {
  const apply = process.argv.includes("--apply");
  const orders = await prisma.bespokeOrder.findMany({
    where: { clientProfileId: null, payments: { some: { status: PaymentStatus.CONFIRMED } } },
    select: { id: true, orderRef: true, clientName: true, clientEmail: true, clientPhone: true },
  });
  console.log(`${orders.length} paid commission(s) without a client profile`);
  for (const o of orders) {
    if (!o.clientEmail?.trim()) {
      console.log(`skip ${o.orderRef}: no email`);
      continue;
    }
    if (!apply) {
      console.log(`would onboard ${o.orderRef} · ${o.clientName}`);
      continue;
    }
    const r = await autoOnboardClient({
      name: o.clientName,
      email: o.clientEmail,
      phone: o.clientPhone ?? undefined,
      source: "BESPOKE_ORDER",
      sourceId: o.id,
    });
    console.log(`${o.orderRef} · ${o.clientName} → ${r.isNew ? "new account" : "existing account"}`);
  }
  if (!apply) console.log("Dry run. Re-run with --apply to write.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
