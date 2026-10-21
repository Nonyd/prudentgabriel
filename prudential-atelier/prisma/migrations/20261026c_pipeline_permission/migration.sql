-- "Change a commission's steps" (bespoke.pipeline): Admins and atelier managers
-- (BESPOKE_MANAGER) have it; the Super Admin has everything. It is not inherited
-- from "bespoke", so staff who complete steps cannot rearrange them.
INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'pipeline-rp-admin', 'ADMIN'::"Role", 'bespoke.pipeline', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'ADMIN'::"Role")
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'ADMIN'::"Role" AND "permission" = 'bespoke.pipeline');

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'pipeline-rp-bespoke-manager', 'BESPOKE_MANAGER'::"Role", 'bespoke.pipeline', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'BESPOKE_MANAGER'::"Role")
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'BESPOKE_MANAGER'::"Role" AND "permission" = 'bespoke.pipeline');

-- Every server reloads role permissions on its next check.
UPDATE "PermissionCacheState" SET "revision" = "revision" + 1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'singleton';
