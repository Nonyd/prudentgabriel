-- Live chat becomes a permission ("chat") instead of an Admin-only page.
-- Admins keep it, so nothing changes for them; the Super Admin has everything.
-- Anyone else (Kemi, a content manager) gets it by a grant in Users & Roles.
INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'chat-rp-admin', 'ADMIN'::"Role", 'chat', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'ADMIN'::"Role")
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'ADMIN'::"Role" AND "permission" = 'chat');

-- Every server reloads role permissions on its next check.
UPDATE "PermissionCacheState" SET "revision" = "revision" + 1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'singleton';
