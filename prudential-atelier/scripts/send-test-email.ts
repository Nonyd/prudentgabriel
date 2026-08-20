/**
 * One-shot provider smoke test (Resend, then Brevo).
 *
 *   pnpm exec tsx --tsconfig tsconfig.scripts.json scripts/send-test-email.ts [to]
 */
import path from "node:path";
import dotenv from "dotenv";
import {
  createBrevoProvider,
  createResendProvider,
} from "../src/lib/email-providers";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const to = process.argv[2]?.trim() || process.env.ADMIN_EMAIL?.trim() || "admin@prudentgabriel.com";
  const from = '"Prudent Gabriel" <hello@prudentgabriel.com>';
  const subject = `Prudent Gabriel email smoke — ${new Date().toISOString()}`;
  const html = `<p>Smoke test from <code>scripts/send-test-email.ts</code>.</p><p>To: ${to}</p>`;
  const text = `Smoke test from scripts/send-test-email.ts. To: ${to}`;

  const providers = [createResendProvider(), createBrevoProvider()].filter((p) => p.isConfigured());

  if (!providers.length) {
    throw new Error("No email provider configured (RESEND_API_KEY / BREVO_API_KEY)");
  }

  let failed = false;
  for (const p of providers) {
    const result = await p.send({ to, from, subject: `${subject} [${p.name}]`, html, text });
    if ("error" in result) {
      failed = true;
      console.error(`[${p.name}] FAIL:`, result.error);
    } else {
      console.log(`[${p.name}] OK id=${result.id}`);
    }
  }
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
