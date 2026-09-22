/**
 * AR5: the two 48-hour figures come from live settings, not the copy.
 *
 *   pnpm test:legal-figures
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { RETURNS_MD, TERMS_MD, legalMdToHtml } from "../src/lib/legal-copy";
import { renderLegalHtml } from "../src/lib/legal-tokens";
import { LEGAL_TOKEN_NAMES } from "../src/lib/legal-token-syntax";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function main() {
  const root = path.join(__dirname, "..");
  const copy = readFileSync(path.join(root, "src/lib/legal-copy.ts"), "utf8");
  assert(!/\b48[ -]hours?\b/i.test(copy), "no hardcoded 48-hour figure left in the legal copy");
  assert(copy.includes("{{post_delivery_fault_hours}}"), "delivery-fault window is a token");
  for (const t of ["fabric_promise_hours", "post_delivery_fault_hours"]) {
    assert((LEGAL_TOKEN_NAMES as readonly string[]).includes(t), `${t} is a known legal token`);
  }

  // A changed setting changes what the customer reads.
  const returns = legalMdToHtml(RETURNS_MD);
  const tokens = { post_delivery_fault_hours: "72", fabric_promise_hours: "24" };
  const html = renderLegalHtml(returns, tokens);
  assert(html.includes("within 72 hours of delivery"), "fault window renders from the setting");
  assert(!html.includes("{{"), "no unresolved tokens");
  assert(renderLegalHtml(legalMdToHtml(TERMS_MD + RETURNS_MD), tokens).includes("24 hours"), "fabric promise renders from the setting");

  // The fabric promise is a setting everywhere a customer or admin sees it.
  for (const rel of [
    "src/components/admin/AdminOrderToolbar.tsx",
    "src/components/product/ProductDetailClient.tsx",
    "src/lib/production-time.ts",
    "src/lib/legal-tokens.ts",
  ]) {
    assert(!readFileSync(path.join(root, rel), "utf8").includes("FABRIC_PROMISE_HOURS,"), `${rel} does not use the constant`);
  }
  const bootstrap = readFileSync(path.join(root, "src/lib/payment-settings-bootstrap.ts"), "utf8");
  assert(bootstrap.includes(`key: "fabric_promise_hours"`) && bootstrap.includes(`key: "post_delivery_fault_hours"`), "both settings are created for admins to edit");
  console.log("OK test-legal-figures");
}

main();
