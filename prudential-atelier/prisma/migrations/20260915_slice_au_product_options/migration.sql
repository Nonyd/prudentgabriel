-- Slice AU: product options (price adjustment on one choice, not a second variant dimension).

CREATE TABLE "ProductOptionGroup" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "includeInSku" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOptionGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductOptionGroup_productId_key" ON "ProductOptionGroup"("productId");

ALTER TABLE "ProductOptionGroup"
  ADD CONSTRAINT "ProductOptionGroup_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProductOption" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "priceAdjustmentNGN" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "skuPart" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductOption_groupId_sortOrder_idx" ON "ProductOption"("groupId", "sortOrder");

ALTER TABLE "ProductOption"
  ADD CONSTRAINT "ProductOption_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "ProductOptionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProductOptionMeasurement" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductOptionMeasurement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductOptionMeasurement_optionId_fieldId_key" ON "ProductOptionMeasurement"("optionId", "fieldId");
CREATE INDEX "ProductOptionMeasurement_optionId_sortOrder_idx" ON "ProductOptionMeasurement"("optionId", "sortOrder");

ALTER TABLE "ProductOptionMeasurement"
  ADD CONSTRAINT "ProductOptionMeasurement_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "ProductOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductOptionMeasurement"
  ADD CONSTRAINT "ProductOptionMeasurement_fieldId_fkey"
  FOREIGN KEY ("fieldId") REFERENCES "MeasurementField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CartItem" ADD COLUMN "optionId" TEXT;

ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "ProductOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD COLUMN "optionId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "optionLabel" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "optionAdjustmentNGN" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "ProductOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
