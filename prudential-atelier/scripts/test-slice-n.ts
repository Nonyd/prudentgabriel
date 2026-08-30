/**
 * Slice N: homepage Best sellers uses the gallery grid, not a forked card.
 *
 *   pnpm test:slice-n
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function run() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const bestSellers = readFileSync(join(root, "src/components/public/BestSellers.tsx"), "utf8");
  const card = readFileSync(join(root, "src/components/common/ProductCard.tsx"), "utf8");
  const grid = readFileSync(join(root, "src/components/common/ProductCardGrid.tsx"), "utf8");

  assert(bestSellers.includes("ProductCardGrid"), "Best sellers must reuse ProductCardGrid");
  assert(!bestSellers.includes("BestSellersGrid"), "do not fork a second product card for Best sellers");
  assert(bestSellers.includes('merchBadge="Best seller"'), "Best sellers keep a rest-state merchandising flag");
  assert(grid.includes("merchBadge"), "ProductCardGrid passes merchBadge through");
  assert(card.includes("product-gallery-merch-badge"), "merch badge has a rest-state class");
  assert(
    !card.includes("product-gallery-hover-only product-gallery-merch-badge") &&
      !card.includes("product-gallery-merch-badge product-gallery-hover-only"),
    "merch badge must stay visible at rest, not hover-only",
  );

  console.log("slice-n: all checks passed");
}

run();
