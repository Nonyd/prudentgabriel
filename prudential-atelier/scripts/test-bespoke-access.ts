/**
 * The atelier and client APIs gate on the same cell as their pages (Slice T),
 * and STAFF act only on the commissions they are assigned to.
 *
 *   pnpm test:bespoke-access                                   # unit (CI)
 *   ALLOW_FIXTURES=true pnpm test:bespoke-access               # + database
 *   ALLOW_FIXTURES=true BASE_URL=http://localhost:3000 pnpm test:bespoke-access   # + live HTTP
 *
 * Before: every /api/bespoke* and /api/clients* route checked a role list that
 * included STAFF, so a beader could complete a stage on a gown she was not on,
 * and Kemi's `bespoke` grant opened pages whose APIs refused her.
 */
import "./preload-test-env";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Role, StaffDepartment } from "@prisma/client";
import { encode } from "next-auth/jwt";
import type { Session } from "next-auth";
import { bespokeAllows, type BespokeFacts } from "../src/lib/atelier/bespoke-access-rules";
import { stageRoleAllows } from "../src/lib/atelier/stage-requirements";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function routesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...routesUnder(p));
    else if (name === "route.ts") out.push(p);
  }
  return out;
}

function unit() {
  const f = (o: Partial<BespokeFacts>): BespokeFacts => ({ house: false, money: false, admin: false, assigned: false, ...o });

  // Assigned STAFF: read and work on their gown; never manage, money or admin.
  const assignedStaff = f({ assigned: true });
  assert(bespokeAllows("read", assignedStaff) && bespokeAllows("work", assignedStaff), "assigned STAFF read and work");
  assert(!bespokeAllows("manage", assignedStaff), "assigned STAFF do not manage");
  assert(!bespokeAllows("money", assignedStaff), "assigned STAFF never touch money");
  // Unassigned STAFF: nothing. This is the gap closed.
  const otherStaff = f({});
  for (const level of ["read", "work", "manage", "money", "admin"] as const) {
    assert(!bespokeAllows(level, otherStaff), `unassigned STAFF refused ${level}`);
  }
  // Kemi: the key (grant), no money role.
  const kemi = f({ house: true });
  assert(bespokeAllows("read", kemi) && bespokeAllows("manage", kemi), "Kemi's grant reaches the atelier APIs");
  assert(!bespokeAllows("money", kemi), "Kemi still cannot touch payments");
  assert(!bespokeAllows("admin", kemi), "Kemi cannot revert or delete");
  // Bespoke manager: key + money; not admin.
  const bm = f({ house: true, money: true });
  assert(bespokeAllows("money", bm) && !bespokeAllows("admin", bm), "bespoke manager: money yes, admin no");
  assert(bespokeAllows("admin", f({ house: true, money: true, admin: true })), "admin reverts and deletes");

  // The engine's own role rule is unchanged, and the page reads it.
  assert(stageRoleAllows("BESPOKE_MANAGER", "TAILORING") && stageRoleAllows("STAFF", "TAILORING"), "engine roles");
  assert(!stageRoleAllows("RTW_MANAGER", "TAILORING"), "the engine still refuses RTW_MANAGER; the page does not offer it");
  assert(stageRoleAllows("SUPER_ADMIN", "DELIVERY"), "super admin always");

  // No atelier, client or moodboard route falls back to a role list.
  const root = process.cwd();
  const routes = [
    ...routesUnder(join(root, "src/app/api/bespoke")),
    ...routesUnder(join(root, "src/app/api/clients")),
    ...routesUnder(join(root, "src/app/api/moodboards")),
  ];
  assert(routes.length > 15, "found the routes");
  for (const r of routes) {
    const src = readFileSync(r, "utf8");
    assert(!src.includes("requireRoles("), `${r.slice(root.length)} still gates on a role list`);
  }
  const gated = (p: string, needle: string) =>
    assert(readFileSync(join(root, p), "utf8").includes(needle), `${p} uses ${needle}`);
  gated("src/app/api/bespoke/[orderId]/complete-stage/route.ts", 'requireBespokeAccess("work"');
  gated("src/app/api/bespoke/[orderId]/stage-media/route.ts", 'requireBespokeAccess("work"');
  gated("src/app/api/bespoke/[orderId]/stage-draft/route.ts", 'requireBespokeAccess("work"');
  gated("src/app/api/bespoke/[orderId]/request-approval/route.ts", 'requireBespokeAccess("work"');
  gated("src/app/api/bespoke/[orderId]/revert-stage/route.ts", 'requireBespokeAccess("admin"');
  gated("src/app/api/bespoke/[orderId]/route.ts", "touchesMoney");
  gated("src/app/api/clients/route.ts", 'key: "clients"');
  gated("src/app/api/clients/[clientId]/measurements/route.ts", "canSeeClientMeasurements");
  gated("src/app/(admin)/admin/bespoke/[orderId]/page.tsx", "bespokeFacts(");
  gated("src/components/admin/BespokeOrderDetailClient.tsx", "stageRoleAllows(");
  console.log("ok unit");
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

async function fixture() {
  const { assertFixturesAllowed } = await import("./fixture-guard");
  assertFixturesAllowed("test-bespoke-access");
  const { prisma } = await import("../src/lib/prisma");
  const stamp = `ba-${Date.now()}`;
  const mkUser = (tag: string, role: Role, isStaff = false) =>
    prisma.user.create({ data: { email: `${stamp}-${tag}@example.test`, name: `BA ${tag}`, role, isStaff, password: "x" } });

  const clientUser = await mkUser("client", Role.CUSTOMER);
  const client = await prisma.clientProfile.create({ data: { userId: clientUser.id } });
  await prisma.measurement.create({ data: { clientId: client.id, bust: 88.8 } });
  const mkOrder = (ref: string) =>
    prisma.bespokeOrder.create({
      data: { orderRef: ref, clientProfileId: client.id, clientName: "BA client", clientEmail: clientUser.email, currentStage: "TAILORING" },
    });
  const mine = await mkOrder(`BA-${stamp}-MINE`);
  const other = await mkOrder(`BA-${stamp}-OTHER`);

  const beaderUser = await mkUser("beader", Role.STAFF, true);
  const beader = await prisma.staffProfile.create({ data: { userId: beaderUser.id, department: StaffDepartment.BEADER } });
  await prisma.orderAssignment.create({ data: { orderId: mine.id, staffProfileId: beader.id, role: "BEADER" } });

  const kemi = await mkUser("kemi", Role.RTW_MANAGER);
  await prisma.userPermission.createMany({
    data: [
      { userId: kemi.id, permission: "bespoke", mode: "GRANT" },
      { userId: kemi.id, permission: "consultations", mode: "GRANT" },
    ],
  });
  const admin = await mkUser("admin", Role.ADMIN);

  const cleanup = async () => {
    const ids = [mine.id, other.id];
    await prisma.orderAssignment.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.bespokeOrder.deleteMany({ where: { id: { in: ids } } });
    const users = await prisma.user.findMany({ where: { email: { startsWith: `${stamp}-` } }, select: { id: true } });
    await prisma.userPermission.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  };
  return { prisma, client, mine, other, beaderUser, kemi, admin, cleanup };
}

async function db(fx: Fixture) {
  const { bespokeFacts } = await import("../src/lib/atelier/bespoke-access");
  const session = (u: { id: string; email: string; role: Role }, grants: string[] = []) =>
    ({ user: { id: u.id, email: u.email, role: u.role, permissionGrants: grants, permissionRevokes: [] }, expires: "" }) as unknown as Session;

  const beader = session(fx.beaderUser);
  const onMine = await bespokeFacts(beader, { orderId: fx.mine.id });
  const onOther = await bespokeFacts(beader, { orderId: fx.other.id });
  assert(bespokeAllows("work", onMine.facts), "the beader works on her own gown");
  assert(!bespokeAllows("work", onOther.facts), "the beader cannot complete a stage on a gown she is not on");
  assert(!bespokeAllows("read", onOther.facts), "nor read it");
  assert(!bespokeAllows("read", (await bespokeFacts(beader)).facts), "nor list every commission");

  const kemi = await bespokeFacts(session(fx.kemi, ["bespoke", "consultations"]), { orderId: fx.mine.id });
  assert(bespokeAllows("manage", kemi.facts), "Kemi's grant reaches the commission APIs");
  assert(!bespokeAllows("money", kemi.facts), "Kemi is refused money");
  const kemiClients = await bespokeFacts(session(fx.kemi, ["bespoke", "consultations"]), { key: "clients" });
  assert(!bespokeAllows("manage", kemiClients.facts), "Kemi has no clients key: the CRM stays closed, page and API alike");

  const admin = await bespokeFacts(session(fx.admin), { orderId: fx.other.id });
  assert(["read", "work", "manage", "money", "admin"].every((l) => bespokeAllows(l as "read", admin.facts)), "ADMIN passes every level");
  console.log("ok db: facts per viewer");
}

async function live(base: string, fx: Fixture) {
  const host = new URL(base).hostname;
  assert(host === "localhost" || host === "127.0.0.1", "live checks run against localhost only");
  const secure = base.startsWith("https://");
  const cookie = async (u: { id: string; email: string; role: Role }) => {
    const name = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    assert(secret, "AUTH_SECRET is set for the local server");
    const token = await encode({
      token: { id: u.id, sub: u.id, email: u.email, role: u.role, iat: Math.floor(Date.now() / 1000) },
      secret,
      salt: name,
    });
    return `${name}=${token}`;
  };
  const call = async (method: string, path: string, u: { id: string; email: string; role: Role }, body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { cookie: await cookie(u), "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    return res.status;
  };

  const b = fx.beaderUser;
  let s = await call("POST", `/api/bespoke/${fx.other.id}/complete-stage`, b, { notes: "done" });
  assert(s === 403, `beader completing a stage on a gown she is not on → 403 (got ${s})`);
  s = await call("POST", `/api/bespoke/${fx.other.id}/stage-draft`, b, { notes: "x" });
  assert(s === 403, `beader drafting on another gown → 403 (got ${s})`);
  s = await call("GET", `/api/bespoke/${fx.other.id}`, b);
  assert(s === 403, `beader reading another gown → 403 (got ${s})`);
  s = await call("GET", `/api/bespoke`, b);
  assert(s === 403, `beader listing every commission → 403 (got ${s})`);
  s = await call("GET", `/api/clients`, b);
  assert(s === 403, `beader listing every client → 403 (got ${s})`);
  s = await call("GET", `/api/bespoke/${fx.mine.id}`, b);
  assert(s === 200, `beader reads her own gown → 200 (got ${s})`);
  s = await call("GET", `/api/clients/${fx.client.id}/file?section=measurements`, b);
  assert(s === 403, `beader measurements on the client file → 403 (got ${s})`);
  s = await call("GET", `/api/clients/${fx.client.id}/file?section=payments`, b);
  assert(s === 403, `STAFF payments on the client file → 403 (got ${s})`);

  const k = fx.kemi;
  s = await call("GET", `/api/bespoke`, k);
  assert(s === 200, `Kemi's grant: the pipeline API now answers her → 200 (got ${s})`);
  s = await call("GET", `/api/bespoke/${fx.mine.id}`, k);
  assert(s === 200, `Kemi reads a commission → 200 (got ${s})`);
  s = await call("PATCH", `/api/bespoke/${fx.mine.id}`, k, { amountPaid: 1000 });
  assert(s === 403, `Kemi recording a payment → 403 (got ${s})`);
  s = await call("GET", `/api/clients`, k);
  assert(s === 403, `Kemi without clients: CRM API refuses, as the page does → 403 (got ${s})`);
  console.log("ok live: HTTP status per viewer");
}

async function main() {
  unit();
  if (process.env.ALLOW_FIXTURES !== "true") {
    console.log("skip database and live checks: set ALLOW_FIXTURES=true (and BASE_URL for live)");
    console.log("OK test-bespoke-access");
    return;
  }
  const fx = await fixture();
  try {
    await db(fx);
    const base = process.env.BASE_URL?.replace(/\/$/, "");
    if (base) await live(base, fx);
    else console.log("skip live checks: set BASE_URL=http://localhost:3000");
  } finally {
    await fx.cleanup();
    await fx.prisma.$disconnect();
  }
  console.log("OK test-bespoke-access");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
