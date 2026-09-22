/**
 * Slice AZ9: one SUPER_ADMIN action signs every account out.
 *
 *   pnpm test:session-revocation                          # unit only (CI)
 *   ALLOW_FIXTURES=true BASE_URL=http://localhost:3000 pnpm test:session-revocation
 *
 * The live part REVOKES EVERY SESSION on the server's database (dev only; the
 * fixture guard refuses production and staging).
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Role } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { prisma } from "../src/lib/prisma";
import { jwtIssuedBeforePasswordChange } from "../src/lib/password-reset";
import { REVOKE_ALL_CONFIRMATION } from "../src/lib/session-revocation";
import { assertFixturesAllowed } from "./fixture-guard";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function unit() {
  const cutoff = new Date("2026-09-22T12:00:00Z");
  const sec = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
  assert(jwtIssuedBeforePasswordChange(sec("2026-09-22T11:59:59Z"), cutoff), "session before the cutoff is dropped");
  assert(!jwtIssuedBeforePasswordChange(sec("2026-09-22T12:00:00Z"), cutoff), "session at the cutoff survives");
  assert(!jwtIssuedBeforePasswordChange(sec("2026-09-22T11:00:00Z"), null), "no cutoff, nothing dropped");
  const root = path.join(__dirname, "..");
  const card = readFileSync(path.join(root, "src/components/admin/settings/SignOutEveryoneCard.tsx"), "utf8");
  assert(card.includes(`"${REVOKE_ALL_CONFIRMATION}"`), "UI asks for the same confirmation the API checks");
  const authTs = readFileSync(path.join(root, "src/lib/auth.ts"), "utf8");
  assert(authTs.includes("sessionRevokedGlobally("), "jwt callback checks the global cutoff");
  console.log("ok unit");
}

async function cookieFor(user: { id: string; email: string }) {
  const name = "authjs.session-token";
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  assert(secret, "AUTH_SECRET set");
  return `${name}=${await encode({ token: { id: user.id, sub: user.id, email: user.email }, secret, salt: name })}`;
}

async function live(base: string) {
  const host = new URL(base).hostname;
  assert(host === "localhost" || host === "127.0.0.1", "live checks run against a local server only");
  assertFixturesAllowed("test-session-revocation");

  const upsert = (email: string, role: Role) =>
    prisma.user.upsert({ where: { email }, update: { role }, create: { email, name: email, role, password: "x" } });
  const superAdmin = await upsert("az9-fixture-superadmin@example.test", Role.SUPER_ADMIN);
  const staff = await upsert("az9-fixture-staff@example.test", Role.STAFF);

  const sessionEmail = async (cookie: string) => {
    const res = await fetch(`${base}/api/auth/session`, { headers: { cookie } });
    const j = (await res.json().catch(() => null)) as { user?: { email?: string } } | null;
    return j?.user?.email ?? null;
  };
  const revoke = (cookie: string, confirm?: string) =>
    fetch(`${base}/api/admin/security/revoke-all-sessions`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(confirm ? { confirm } : {}),
    });

  const staffCookie = await cookieFor(staff);
  const adminCookie = await cookieFor(superAdmin);
  assert((await sessionEmail(staffCookie)) === staff.email, "staff session valid before");
  assert((await sessionEmail(adminCookie)) === superAdmin.email, "super admin session valid before");

  assert((await revoke(staffCookie, REVOKE_ALL_CONFIRMATION)).status === 403, "STAFF cannot sign everyone out");
  assert((await revoke(adminCookie)).status === 400, "confirmation is required");
  const ok = await revoke(adminCookie, REVOKE_ALL_CONFIRMATION);
  assert(ok.status === 200, `super admin signs everyone out (${ok.status})`);
  const { revokedAt } = (await ok.json()) as { revokedAt: string };

  assert((await sessionEmail(staffCookie)) === null, "existing staff session is dead");
  assert((await sessionEmail(adminCookie)) === null, "the super admin's own session is dead too");

  await sleep(Math.max(0, new Date(revokedAt).getTime() - Date.now()) + 1100);
  const fresh = await cookieFor(staff);
  assert((await sessionEmail(fresh)) === staff.email, "a session issued after the cutoff works");

  const logged = await prisma.activityLog.findFirst({
    where: { module: "security", userEmail: superAdmin.email },
    orderBy: { createdAt: "desc" },
  });
  assert(logged && logged.description.includes("Signed out every account"), "the action is logged");
  console.log("ok live: one action ends every session; new sign-ins work; logged");
}

async function main() {
  unit();
  const base = process.env.BASE_URL?.replace(/\/$/, "");
  if (base) await live(base);
  else console.log("skip live checks: set ALLOW_FIXTURES=true BASE_URL=http://localhost:…");
  console.log("OK test-session-revocation");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
