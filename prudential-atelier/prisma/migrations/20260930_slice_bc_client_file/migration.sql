-- Slice BC: the client file.
--
-- BC2: a library of construction features the house defines once and ticks per
-- commission, so "which gowns had a corset" is a query rather than a text search.
-- BC3: the delivery date agreed with the quotation, carried onto the commission's
-- existing deliveryDate at convert; and an index so a month's deliveries are cheap.

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN "expectedDeliveryDate" DATE;

-- CreateTable
CREATE TABLE "ConstructionFeature" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "group" TEXT,
    "helpText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionFeature" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "note" TEXT,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionFeature_key_key" ON "ConstructionFeature"("key");

-- CreateIndex
CREATE INDEX "ConstructionFeature_archivedAt_sortOrder_idx" ON "ConstructionFeature"("archivedAt", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionFeature_orderId_featureId_key" ON "CommissionFeature"("orderId", "featureId");

-- CreateIndex
CREATE INDEX "CommissionFeature_featureId_idx" ON "CommissionFeature"("featureId");

-- CreateIndex
CREATE INDEX "BespokeOrder_deliveryDate_idx" ON "BespokeOrder"("deliveryDate");

-- AddForeignKey
ALTER TABLE "CommissionFeature" ADD CONSTRAINT "CommissionFeature_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BespokeOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionFeature" ADD CONSTRAINT "CommissionFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "ConstructionFeature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: the features named at the 30 September meeting. The house adds more from
-- the admin, without a deploy. ON CONFLICT keeps a re-run harmless.
INSERT INTO "ConstructionFeature" ("id", "key", "label", "group", "sortOrder", "updatedAt") VALUES
    ('bc_feature_mermaid',      'mermaid',      'Mermaid',      'Silhouette', 10, CURRENT_TIMESTAMP),
    ('bc_feature_cup_corset',   'cup_corset',   'Cup corset',   'Bodice',     20, CURRENT_TIMESTAMP),
    ('bc_feature_train',        'train',        'Train',        'Train',      30, CURRENT_TIMESTAMP),
    ('bc_feature_long_sleeves', 'long_sleeves', 'Long sleeves', 'Sleeves',    40, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
