import { prisma } from "@/lib/prisma";
import { ROLE_PERMISSIONS } from "@/lib/roles";
import {
  applyUserOverrides,
  serializePermissionSet,
  toPermissionSet,
  type AccessActor,
} from "@/lib/permission-resolve";

const CACHE_ID = "singleton";
const REVISION_CHECK_MS = 2_000;

type RoleMap = Map<string, ReadonlySet<string> | "*">;

let roleMap: RoleMap | null = null;
let localRevision = -1;
let lastRevisionCheckAt = 0;
let loadPromise: Promise<void> | null = null;

function seedMap(): RoleMap {
  const map: RoleMap = new Map();
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    if (perms[0] === "*") {
      map.set(role, "*");
    } else {
      map.set(role, new Set(perms as readonly string[]));
    }
  }
  return map;
}

function skipDb(): boolean {
  return process.env.SKIP_DB_BUILD === "1" || process.env.NODE_ENV === "test";
}

async function readRevision(): Promise<number> {
  const row = await prisma.permissionCacheState.findUnique({
    where: { id: CACHE_ID },
    select: { revision: true },
  });
  return row?.revision ?? 0;
}

async function loadFromDb(): Promise<RoleMap> {
  const rows = await prisma.rolePermission.findMany({
    select: { role: true, permission: true },
  });
  const map: RoleMap = seedMap();
  if (rows.length === 0) return map;

  const grouped = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = grouped.get(row.role) ?? new Set<string>();
    set.add(row.permission);
    grouped.set(row.role, set);
  }
  Array.from(grouped.entries()).forEach(([role, set]) => {
    map.set(role, set);
  });
  map.set("SUPER_ADMIN", "*");
  return map;
}

async function hydrate(): Promise<void> {
  if (skipDb()) {
    roleMap = seedMap();
    localRevision = 0;
    lastRevisionCheckAt = Date.now();
    return;
  }
  try {
    const [map, revision] = await Promise.all([loadFromDb(), readRevision()]);
    roleMap = map;
    localRevision = revision;
    lastRevisionCheckAt = Date.now();
  } catch {
    roleMap = seedMap();
    localRevision = -1;
    lastRevisionCheckAt = Date.now();
  }
}

/**
 * In-memory role map. User grants/revokes come from the session (already loaded
 * with the JWT user row). Revision is checked at most every 2s so a second
 * container picks up a role save without a query on every admin request.
 */
export async function ensurePermissionCache(): Promise<void> {
  const now = Date.now();
  if (roleMap && now - lastRevisionCheckAt < REVISION_CHECK_MS) return;
  if (loadPromise) {
    await loadPromise;
    return;
  }
  loadPromise = (async () => {
    if (!roleMap) {
      await hydrate();
      return;
    }
    if (skipDb()) {
      lastRevisionCheckAt = Date.now();
      return;
    }
    try {
      const revision = await readRevision();
      if (revision !== localRevision) {
        await hydrate();
        return;
      }
      lastRevisionCheckAt = Date.now();
    } catch {
      lastRevisionCheckAt = Date.now();
    }
  })().finally(() => {
    loadPromise = null;
  });
  await loadPromise;
}

export function peekRolePermissions(role: string | undefined | null): readonly string[] | "*" | undefined {
  if (!role) return [];
  const set = roleMap?.get(role);
  if (set === undefined) return undefined;
  return serializePermissionSet(set);
}

export function cachedRoleActorPatch(role: string | undefined | null): Pick<AccessActor, "rolePermissions"> {
  const peeked = peekRolePermissions(role);
  if (peeked === undefined) return {};
  return { rolePermissions: peeked };
}

export async function bumpPermissionCache(): Promise<void> {
  if (skipDb()) {
    roleMap = seedMap();
    localRevision += 1;
    lastRevisionCheckAt = Date.now();
    return;
  }
  await prisma.permissionCacheState.upsert({
    where: { id: CACHE_ID },
    create: { id: CACHE_ID, revision: 1 },
    update: { revision: { increment: 1 } },
  });
  roleMap = null;
  localRevision = -1;
  lastRevisionCheckAt = 0;
  await ensurePermissionCache();
}

/** Tests: install an in-memory map without Prisma. */
export function installPermissionCacheForTests(map?: RoleMap): void {
  roleMap = map ?? seedMap();
  localRevision = 0;
  lastRevisionCheckAt = Date.now();
}

export function resetPermissionCacheForTests(): void {
  roleMap = null;
  localRevision = -1;
  lastRevisionCheckAt = 0;
}

export { toPermissionSet, applyUserOverrides };
