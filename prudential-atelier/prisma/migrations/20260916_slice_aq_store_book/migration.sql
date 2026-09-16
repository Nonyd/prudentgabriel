-- Slice AQ phase 1: replace the store book.
-- STORE_MANAGER is a role; grant it to a person in Users & Roles, not by seeding a user.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'STORE_MANAGER';

CREATE TYPE "StoreLine" AS ENUM ('SHARED', 'ATELIER', 'RTW');

CREATE TYPE "StoreMovementReason" AS ENUM (
  'OPENING',
  'RECEIPT',
  'ISSUE',
  'RETURN',
  'ADJUSTMENT',
  'WRITE_OFF'
);

CREATE TABLE "ItemCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ItemCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ItemCategory_name_key" ON "ItemCategory"("name");

CREATE TABLE "StoreItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "spec" TEXT,
    "supplier" TEXT,
    "unitCost" DECIMAL(12,2),
    "storeLine" "StoreLine" NOT NULL DEFAULT 'SHARED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreItem_categoryId_isActive_idx" ON "StoreItem"("categoryId", "isActive");
CREATE INDEX "StoreItem_name_idx" ON "StoreItem"("name");

CREATE TABLE "StoreMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "delta" DECIMAL(12,4) NOT NULL,
    "reason" "StoreMovementReason" NOT NULL,
    "actorId" TEXT NOT NULL,
    "note" TEXT,
    "ref" TEXT,
    "takenById" TEXT,
    "approvedById" TEXT,
    "receivedById" TEXT,
    "bespokeOrderId" TEXT,
    "orderId" TEXT,
    "issueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreMovement_itemId_createdAt_idx" ON "StoreMovement"("itemId", "createdAt");
CREATE INDEX "StoreMovement_reason_createdAt_idx" ON "StoreMovement"("reason", "createdAt");
CREATE INDEX "StoreMovement_ref_idx" ON "StoreMovement"("ref");
CREATE INDEX "StoreMovement_issueId_idx" ON "StoreMovement"("issueId");
CREATE INDEX "StoreMovement_bespokeOrderId_idx" ON "StoreMovement"("bespokeOrderId");
CREATE INDEX "StoreMovement_orderId_idx" ON "StoreMovement"("orderId");

CREATE TABLE "StoreBook" (
    "id" TEXT NOT NULL,
    "dayOne" TIMESTAMP(3),
    "lockedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    CONSTRAINT "StoreBook_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Material" ADD COLUMN "storeItemId" TEXT;
ALTER TABLE "Material" ADD COLUMN "storeMovementId" TEXT;
CREATE UNIQUE INDEX "Material_storeMovementId_key" ON "Material"("storeMovementId");

ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ItemCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StoreMovement" ADD CONSTRAINT "StoreMovement_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "StoreItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreMovement" ADD CONSTRAINT "StoreMovement_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreMovement" ADD CONSTRAINT "StoreMovement_takenById_fkey"
  FOREIGN KEY ("takenById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreMovement" ADD CONSTRAINT "StoreMovement_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreMovement" ADD CONSTRAINT "StoreMovement_receivedById_fkey"
  FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreMovement" ADD CONSTRAINT "StoreMovement_bespokeOrderId_fkey"
  FOREIGN KEY ("bespokeOrderId") REFERENCES "BespokeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreMovement" ADD CONSTRAINT "StoreMovement_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreMovement" ADD CONSTRAINT "StoreMovement_issueId_fkey"
  FOREIGN KEY ("issueId") REFERENCES "StoreMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StoreBook" ADD CONSTRAINT "StoreBook_lockedById_fkey"
  FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Material" ADD CONSTRAINT "Material_storeItemId_fkey"
  FOREIGN KEY ("storeItemId") REFERENCES "StoreItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Material" ADD CONSTRAINT "Material_storeMovementId_fkey"
  FOREIGN KEY ("storeMovementId") REFERENCES "StoreMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "ItemCategory" ("id", "name", "sortOrder") VALUES
  ('store-cat-fabric', 'Fabric', 10),
  ('store-cat-zips', 'Zips', 20),
  ('store-cat-thread', 'Thread', 30),
  ('store-cat-beads', 'Beads', 40);

INSERT INTO "StoreBook" ("id") VALUES ('house');

-- Role catalogue: add `store` where those roles already have Slice T rows.
-- Does not create a storekeeper user. STORE_MANAGER rows wait for the next
-- migration — a new enum value cannot be inserted in the same transaction.
INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'store-rp-admin', 'ADMIN', 'store', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'ADMIN')
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'ADMIN' AND "permission" = 'store');

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'store-rp-staff-admin', 'STAFF_ADMIN', 'store', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'STAFF_ADMIN')
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'STAFF_ADMIN' AND "permission" = 'store');

CREATE OR REPLACE FUNCTION store_movement_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.ledger_bypass', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Store ledger is append-only: DELETE is not allowed (id=%)', OLD.id;
  END IF;

  IF NEW.delta IS DISTINCT FROM OLD.delta THEN
    RAISE EXCEPTION 'Store ledger is append-only: column "delta" cannot be updated (id=%). Insert a correction row instead.', OLD.id;
  END IF;
  IF NEW.reason IS DISTINCT FROM OLD.reason THEN
    RAISE EXCEPTION 'Store ledger is append-only: column "reason" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."itemId" IS DISTINCT FROM OLD."itemId" THEN
    RAISE EXCEPTION 'Store ledger is append-only: column "itemId" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Store ledger is append-only: column "createdAt" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."actorId" IS DISTINCT FROM OLD."actorId" THEN
    RAISE EXCEPTION 'Store ledger is append-only: column "actorId" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."takenById" IS DISTINCT FROM OLD."takenById" THEN
    RAISE EXCEPTION 'Store ledger is append-only: column "takenById" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."approvedById" IS DISTINCT FROM OLD."approvedById" THEN
    RAISE EXCEPTION 'Store ledger is append-only: column "approvedById" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."receivedById" IS DISTINCT FROM OLD."receivedById" THEN
    RAISE EXCEPTION 'Store ledger is append-only: column "receivedById" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."bespokeOrderId" IS DISTINCT FROM OLD."bespokeOrderId" THEN
    RAISE EXCEPTION 'Store ledger is append-only: column "bespokeOrderId" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."orderId" IS DISTINCT FROM OLD."orderId" THEN
    RAISE EXCEPTION 'Store ledger is append-only: column "orderId" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW."issueId" IS DISTINCT FROM OLD."issueId" THEN
    RAISE EXCEPTION 'Store ledger is append-only: column "issueId" cannot be updated (id=%).', OLD.id;
  END IF;
  IF NEW.ref IS DISTINCT FROM OLD.ref THEN
    RAISE EXCEPTION 'Store ledger is append-only: column "ref" cannot be updated (id=%).', OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_movement_append_only_trg ON "StoreMovement";
CREATE TRIGGER store_movement_append_only_trg
  BEFORE UPDATE OR DELETE ON "StoreMovement"
  FOR EACH ROW
  EXECUTE PROCEDURE store_movement_append_only();
