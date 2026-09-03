/**
 * Print cached ProductVariant.stock vs sum(StockMovement.delta) for every variant.
 * Writes missing OPENING rows, then prints again. Any mismatch fails.
 *
 *   pnpm reconcile:stock
 */
import "./preload-test-env";
import { prisma } from "../src/lib/prisma";
import { ensureAllOpeningMovements, reconcileVariantStock } from "../src/lib/stock-ledger";

function printReport(
  label: string,
  result: Awaited<ReturnType<typeof reconcileVariantStock>>,
) {
  console.log(`\n${label}: ${result.rows.length} variants, ${result.mismatches.length} mismatches`);
  for (const r of result.rows) {
    const mark = r.cached === r.summed ? "ok" : "MISMATCH";
    console.log(`  ${mark}  ${r.variantId}  cache=${r.cached}  movements=${r.summed}`);
  }
}

async function main() {
  const before = await reconcileVariantStock(prisma);
  printReport("Before opening backfill", before);

  const created = await ensureAllOpeningMovements(prisma);
  console.log(`\nOPENING rows created: ${created}`);

  const after = await reconcileVariantStock(prisma);
  printReport("After opening backfill", after);

  if (!after.ok) {
    throw new Error(`Stock ledger reconcile failed (${after.mismatches.length} variants)`);
  }
  console.log("\nreconcile:stock passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
