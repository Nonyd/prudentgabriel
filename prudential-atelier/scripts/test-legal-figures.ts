/**
 * AR5: the two 48-hour figures come from live settings, not the copy.
 *
 *   pnpm test:legal-figures
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { RETURNS_MD, TERMS_MD, legalMdToHtml } from "../src/lib/legal-copy";
import { renderLegalHtml } from "../src/lib/legal-tokens";
import { LEGAL_TOKEN_NAMES } from "../src/lib/legal-token-syntax";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function main() {
  const root = path.join(__dirname, "..");
  // ND-1: the policy texts moved to src/lib/legal/*.ts; legal-copy.ts re-exports them.
  const legalDir = path.join(root, "src/lib/legal");
  const copy = [
    readFileSync(path.join(root, "src/lib/legal-copy.ts"), "utf8"),
    ...readdirSync(legalDir)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => readFileSync(path.join(legalDir, f), "utf8")),
  ].join("\n");
  // The one fixed 48 hours the copy may name is the consultation cancellation cut-off,
  // which the cancel route hard-codes; it must stay in step with that route.
  const consultationCutoff = /\b48 hours before\b/gi;
  if (consultationCutoff.test(copy)) {
    const cancelRoute = readFileSync(path.join(root, "src/app/api/account/consultations/[id]/route.ts"), "utf8");
    assert(cancelRoute.includes("48 * 60 * 60 * 1000"), "consultation cancellation cut-off in the terms matches the cancel route");
  }
  assert(!/\b48[ -]hours?\b/i.test(copy.replace(consultationCutoff, "")), "no hardcoded 48-hour figure left in the legal copy");
  assert(copy.includes("{{post_delivery_fault_hours}}"), "delivery-fault window is a token");
  assert(RETURNS_MD.includes("{{post_delivery_fault_hours}} hours of delivery"), "returns policy states the fault window from the token");
  assert(TERMS_MD.includes("{{post_delivery_fault_hours}}"), "terms state the fault window from the token");
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
