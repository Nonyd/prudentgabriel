-- Slice AA: Finance Manager reaches reports and bank accounts, not the rest of Settings.
-- Only insert when this role already has RolePermission rows. An empty table means
-- the cache falls through to ROLE_PERMISSIONS; inserting two keys would replace the
-- whole seed set with just those two.

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'rp_FINANCE_MANAGER_reports', 'FINANCE_MANAGER'::"Role", 'reports', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'FINANCE_MANAGER')
ON CONFLICT ("role", "permission") DO NOTHING;

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'rp_FINANCE_MANAGER_settings_bank_accounts', 'FINANCE_MANAGER'::"Role", 'settings.bank-accounts', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'FINANCE_MANAGER')
ON CONFLICT ("role", "permission") DO NOTHING;

UPDATE "PermissionCacheState"
SET "revision" = "revision" + 1, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'singleton'
  AND EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'FINANCE_MANAGER');
