-- PROCUREMENT_OFFICER enum is committed by the previous migration.
-- Role catalogue row only — no person seeded.

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'store-rp-procurement-buy', 'PROCUREMENT_OFFICER'::"Role", 'requisition.buy', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "RolePermission" WHERE "role" = 'PROCUREMENT_OFFICER'::"Role" AND "permission" = 'requisition.buy'
);

-- Baseline grants for existing roles that already have Slice T rows.
INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'aq-rp-admin-prod-cost', 'ADMIN', 'production.cost', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'ADMIN')
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'ADMIN' AND "permission" = 'production.cost');

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'aq-rp-admin-req-approve', 'ADMIN', 'requisition.approve', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'ADMIN')
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'ADMIN' AND "permission" = 'requisition.approve');

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'aq-rp-admin-req-fund', 'ADMIN', 'requisition.fund', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'ADMIN')
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'ADMIN' AND "permission" = 'requisition.fund');

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'aq-rp-sa-prod-cost', 'STAFF_ADMIN', 'production.cost', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'STAFF_ADMIN')
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'STAFF_ADMIN' AND "permission" = 'production.cost');

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'aq-rp-sa-req-approve', 'STAFF_ADMIN', 'requisition.approve', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'STAFF_ADMIN')
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'STAFF_ADMIN' AND "permission" = 'requisition.approve');

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'aq-rp-bm-prod-cost', 'BESPOKE_MANAGER', 'production.cost', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'BESPOKE_MANAGER')
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'BESPOKE_MANAGER' AND "permission" = 'production.cost');

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'aq-rp-bm-req-approve', 'BESPOKE_MANAGER', 'requisition.approve', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'BESPOKE_MANAGER')
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'BESPOKE_MANAGER' AND "permission" = 'requisition.approve');
