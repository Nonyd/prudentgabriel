-- STORE_MANAGER enum value is committed by the previous migration.
-- Grant the catalogue row here; still no storekeeper user.

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'store-rp-store-manager', 'STORE_MANAGER'::"Role", 'store', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "RolePermission" WHERE "role" = 'STORE_MANAGER'::"Role" AND "permission" = 'store'
);
