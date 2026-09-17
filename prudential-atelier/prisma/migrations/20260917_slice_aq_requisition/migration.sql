-- Slice AQ phases 2–3: cost of production, requisition chain, product materials.
-- PROCUREMENT_OFFICER is a role; grant it to a person in Users & Roles, not by seeding.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PROCUREMENT_OFFICER';
ALTER TYPE "AdminNotificationType" ADD VALUE IF NOT EXISTS 'REQUISITION_PENDING';

CREATE TYPE "CostOfProductionStatus" AS ENUM ('DRAFT', 'APPROVED');

CREATE TYPE "RequisitionStatus" AS ENUM (
  'RAISED',
  'STOCK_CHECKED',
  'WITH_ACCOUNTS',
  'AWAITING_FUNDS',
  'FUNDED',
  'PURCHASED',
  'RECEIVED',
  'CLOSED',
  'DECLINED'
);

CREATE TABLE "CostOfProduction" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "bespokeOrderId" TEXT,
    "tailorCostNGN" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "status" "CostOfProductionStatus" NOT NULL DEFAULT 'DRAFT',
    "draftedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CostOfProduction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CostOfProduction_bespokeOrderId_idx" ON "CostOfProduction"("bespokeOrderId");
CREATE INDEX "CostOfProduction_orderId_idx" ON "CostOfProduction"("orderId");
CREATE INDEX "CostOfProduction_status_idx" ON "CostOfProduction"("status");

CREATE TABLE "CostOfProductionItem" (
    "id" TEXT NOT NULL,
    "costOfProductionId" TEXT NOT NULL,
    "itemId" TEXT,
    "freeText" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "estimatedCostNGN" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "CostOfProductionItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CostOfProductionItem_costOfProductionId_idx" ON "CostOfProductionItem"("costOfProductionId");

CREATE TABLE "Requisition" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "costOfProductionId" TEXT,
    "orderId" TEXT,
    "bespokeOrderId" TEXT,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'RAISED',
    "raisedById" TEXT NOT NULL,
    "notes" TEXT,
    "declineReason" TEXT,
    "sameActorShortCircuit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Requisition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Requisition_ref_key" ON "Requisition"("ref");
CREATE INDEX "Requisition_status_createdAt_idx" ON "Requisition"("status", "createdAt");
CREATE INDEX "Requisition_orderId_idx" ON "Requisition"("orderId");
CREATE INDEX "Requisition_bespokeOrderId_idx" ON "Requisition"("bespokeOrderId");

CREATE TABLE "RequisitionLine" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "itemId" TEXT,
    "freeText" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "estimatedCostNGN" DECIMAL(12,2) NOT NULL,
    "confirmedQuantity" DECIMAL(12,4),
    "coveredByStock" BOOLEAN NOT NULL DEFAULT false,
    "shortfallQuantity" DECIMAL(12,4),
    CONSTRAINT "RequisitionLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RequisitionLine_requisitionId_idx" ON "RequisitionLine"("requisitionId");

CREATE TABLE "RequisitionEvent" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "fromStatus" "RequisitionStatus",
    "toStatus" "RequisitionStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "note" TEXT,
    "sameActorAsPrevious" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequisitionEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RequisitionEvent_requisitionId_createdAt_idx" ON "RequisitionEvent"("requisitionId", "createdAt");

CREATE TABLE "ProductMaterial" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productOptionId" TEXT,
    "itemId" TEXT NOT NULL,
    "quantityPerUnit" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductMaterial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductMaterial_productId_idx" ON "ProductMaterial"("productId");
CREATE INDEX "ProductMaterial_productOptionId_idx" ON "ProductMaterial"("productOptionId");
CREATE INDEX "ProductMaterial_itemId_idx" ON "ProductMaterial"("itemId");

ALTER TABLE "CostOfProduction" ADD CONSTRAINT "CostOfProduction_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CostOfProduction" ADD CONSTRAINT "CostOfProduction_bespokeOrderId_fkey"
  FOREIGN KEY ("bespokeOrderId") REFERENCES "BespokeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CostOfProduction" ADD CONSTRAINT "CostOfProduction_draftedById_fkey"
  FOREIGN KEY ("draftedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CostOfProduction" ADD CONSTRAINT "CostOfProduction_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CostOfProductionItem" ADD CONSTRAINT "CostOfProductionItem_costOfProductionId_fkey"
  FOREIGN KEY ("costOfProductionId") REFERENCES "CostOfProduction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CostOfProductionItem" ADD CONSTRAINT "CostOfProductionItem_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "StoreItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_costOfProductionId_fkey"
  FOREIGN KEY ("costOfProductionId") REFERENCES "CostOfProduction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_bespokeOrderId_fkey"
  FOREIGN KEY ("bespokeOrderId") REFERENCES "BespokeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_raisedById_fkey"
  FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RequisitionLine" ADD CONSTRAINT "RequisitionLine_requisitionId_fkey"
  FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequisitionLine" ADD CONSTRAINT "RequisitionLine_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "StoreItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RequisitionEvent" ADD CONSTRAINT "RequisitionEvent_requisitionId_fkey"
  FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequisitionEvent" ADD CONSTRAINT "RequisitionEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductMaterial" ADD CONSTRAINT "ProductMaterial_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductMaterial" ADD CONSTRAINT "ProductMaterial_productOptionId_fkey"
  FOREIGN KEY ("productOptionId") REFERENCES "ProductOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductMaterial" ADD CONSTRAINT "ProductMaterial_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "StoreItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
