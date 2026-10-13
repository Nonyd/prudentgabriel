/**
 * BD8: text-9px … text-40px are font sizes. cn() must keep a colour class next
 * to them (the regression: every admin Button lost text-cream), and still let a
 * later size replace an earlier one.
 *
 *   pnpm test:type-scale
 */
import { cn } from "../src/lib/utils";
import { PX_TEXT_SIZES } from "../src/lib/type-scale";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

for (const n of PX_TEXT_SIZES) {
  const out = cn(`text-cream text-${n}px`).split(" ");
  assert(out.includes("text-cream") && out.includes(`text-${n}px`), `text-${n}px keeps the colour beside it (got "${out.join(" ")}")`);
}
assert(cn("text-10px", "text-12px") === "text-12px", "a later size replaces an earlier one");
assert(cn("text-xs", "text-11px") === "text-11px", "named and pixel sizes are one group");
console.log("OK test-type-scale");
