/**
 * Apply t3-quotations-bespoke, t3-clients-bespoke and t3-invoices-bespoke
 * through the Slice T commit path. Does not edit ROLE_PERMISSIONS seed.
 * Logs via logPermissionChange.
 *
 *   pnpm tsx --tsconfig tsconfig.scripts.json scripts/apply-t3-bespoke-manager.ts
 */
import { Role } from "@prisma/client";
import "./preload-test-env";
import { prisma } from "../src/lib/prisma";
import { commitRolePermissions } from "../src/lib/permission-commit";
import { ROLE_PERMISSION_PROPOSALS } from "../src/lib/permission-catalog";
import { seedRolePermissionSet } from "../src/lib/roles";
import { serializePermissionSet } from "../src/lib/permission-resolve";
import type { Session } from "next-auth";

async function currentPermissions(role: string): Promise<string[]> {
  const rows = await prisma.rolePermission.findMany({
    where: { role: "BESPOKE_MANAGER" as Role },
    select: { permission: true },
  });
  if (rows.length > 0) return rows.map((r) => r.permission);
  const seed = seedRolePermissionSet(role);
  const serialized = serializePermissionSet(seed);
  return Array.isArray(serialized) ? serialized : [];
}

async function run() {
  const actor = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } },
    select: { id: true, email: true, role: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (!actor) throw new Error("No SUPER_ADMIN/ADMIN user to log the Slice T change");

  const session = {
    user: { id: actor.id, email: actor.email, role: actor.role, name: actor.name },
    expires: new Date(Date.now() + 60_000).toISOString(),
  } as Session;

  const ids = ["t3-quotations-bespoke", "t3-clients-bespoke", "t3-invoices-bespoke"] as const;
  const proposals = ROLE_PERMISSION_PROPOSALS.filter((p) => ids.includes(p.id as (typeof ids)[number]));
  if (proposals.length !== 3) throw new Error("Expected all three t3-bespoke-manager proposals in the catalog");

  let permissions = await currentPermissions("BESPOKE_MANAGER");
  const next = new Set(permissions);
  for (const p of proposals) {
    for (const perm of p.add) next.add(perm);
  }

  const result = await commitRolePermissions({
    session,
    role: "BESPOKE_MANAGER",
    permissions: Array.from(next),
  });

  console.log(JSON.stringify({ ok: true, ...result, applied: ids }, null, 2));
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
