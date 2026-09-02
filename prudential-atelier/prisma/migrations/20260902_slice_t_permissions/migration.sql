-- Slice T Step 4: editable role/user permissions. Seeded from ROLE_PERMISSIONS.

DO $$ BEGIN
  CREATE TYPE "PermissionMode" AS ENUM ('GRANT', 'REVOKE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RolePermission" (
  "id" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "permission" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_role_permission_key" ON "RolePermission"("role", "permission");
CREATE INDEX IF NOT EXISTS "RolePermission_role_idx" ON "RolePermission"("role");

CREATE TABLE IF NOT EXISTS "UserPermission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "mode" "PermissionMode" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserPermission_userId_permission_key" ON "UserPermission"("userId", "permission");
CREATE INDEX IF NOT EXISTS "UserPermission_userId_idx" ON "UserPermission"("userId");

ALTER TABLE "UserPermission"
  ADD CONSTRAINT "UserPermission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "PermissionCacheState" (
  "id" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PermissionCacheState_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PermissionCacheState" ("id", "revision", "updatedAt")
VALUES ('singleton', 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
VALUES
  ('rp_ADMIN_dashboard', 'ADMIN', 'dashboard', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_ADMIN_bespoke', 'ADMIN', 'bespoke', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_ADMIN_consultations', 'ADMIN', 'consultations', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_ADMIN_invoices', 'ADMIN', 'invoices', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_ADMIN_quotations', 'ADMIN', 'quotations', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_ADMIN_shop', 'ADMIN', 'shop', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_ADMIN_clients', 'ADMIN', 'clients', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_ADMIN_staff', 'ADMIN', 'staff', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_ADMIN_attendance', 'ADMIN', 'attendance', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_ADMIN_finance', 'ADMIN', 'finance', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_ADMIN_payments', 'ADMIN', 'payments', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_ADMIN_reports', 'ADMIN', 'reports', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_ADMIN_content', 'ADMIN', 'content', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_ADMIN_logs', 'ADMIN', 'logs', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_ADMIN_settings', 'ADMIN', 'settings', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_STAFF_ADMIN_dashboard', 'STAFF_ADMIN', 'dashboard', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_STAFF_ADMIN_bespoke', 'STAFF_ADMIN', 'bespoke', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_STAFF_ADMIN_consultations', 'STAFF_ADMIN', 'consultations', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_STAFF_ADMIN_invoices', 'STAFF_ADMIN', 'invoices', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_STAFF_ADMIN_quotations', 'STAFF_ADMIN', 'quotations', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_STAFF_ADMIN_shop', 'STAFF_ADMIN', 'shop', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_STAFF_ADMIN_clients', 'STAFF_ADMIN', 'clients', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_STAFF_ADMIN_staff', 'STAFF_ADMIN', 'staff', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_STAFF_ADMIN_attendance', 'STAFF_ADMIN', 'attendance', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_STAFF_ADMIN_finance', 'STAFF_ADMIN', 'finance', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_STAFF_ADMIN_payments', 'STAFF_ADMIN', 'payments', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_STAFF_ADMIN_content', 'STAFF_ADMIN', 'content', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_BESPOKE_MANAGER_bespoke', 'BESPOKE_MANAGER', 'bespoke', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_BESPOKE_MANAGER_consultations', 'BESPOKE_MANAGER', 'consultations', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_BESPOKE_MANAGER_clients_view', 'BESPOKE_MANAGER', 'clients.view', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_RTW_MANAGER_shop_products', 'RTW_MANAGER', 'shop.products', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_RTW_MANAGER_shop_orders', 'RTW_MANAGER', 'shop.orders', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_CONTENT_MANAGER_content_blog', 'CONTENT_MANAGER', 'content.blog', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_CONTENT_MANAGER_content_pages', 'CONTENT_MANAGER', 'content.pages', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_FINANCE_MANAGER_invoices', 'FINANCE_MANAGER', 'invoices', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_FINANCE_MANAGER_quotations', 'FINANCE_MANAGER', 'quotations', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_FINANCE_MANAGER_finance', 'FINANCE_MANAGER', 'finance', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_FINANCE_MANAGER_payments', 'FINANCE_MANAGER', 'payments', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_HR_MANAGER_staff', 'HR_MANAGER', 'staff', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_HR_MANAGER_attendance', 'HR_MANAGER', 'attendance', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_CONSULTATION_MANAGER_consultations', 'CONSULTATION_MANAGER', 'consultations', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rp_CONSULTATION_MANAGER_clients_view', 'CONSULTATION_MANAGER', 'clients.view', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("role", "permission") DO NOTHING;
