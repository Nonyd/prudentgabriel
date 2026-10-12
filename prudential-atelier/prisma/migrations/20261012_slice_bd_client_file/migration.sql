-- Slice BD: the client file as the house actually works (12 October meeting).
--
-- BD1: a composed title per commission (with a house override), a garment-type
--      library seeded with the three Mrs. Prudent named, and the event date.
-- BD2: CommissionNote — append-only notes on a consultation or a commission.
-- BD3: Material carries what kind of specification it is, with pictures.
-- BD4: labour lines on the existing cost-of-production sheet, one per person.
-- BD6: measurements taken per commission (snapshot), the client row stays latest.
-- BD7: WorkLog — the workroom's end-of-day entry per assigned commission.

-- AlterTable
ALTER TABLE "BespokeOrder" ADD COLUMN     "eventDate" DATE,
ADD COLUMN     "garmentTypeId" TEXT,
ADD COLUMN     "measurementsSnapshot" JSONB,
ADD COLUMN     "measurementsTakenAt" TIMESTAMP(3),
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "addedById" TEXT,
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "kind" TEXT;

-- CreateTable
CREATE TABLE "GarmentType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionNote" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "consultationId" TEXT,
    "section" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT,
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostOfProductionLabour" (
    "id" TEXT NOT NULL,
    "costOfProductionId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "role" TEXT NOT NULL,
    "description" TEXT,
    "amountNGN" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostOfProductionLabour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLog" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "done" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "blocker" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "partDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GarmentType_key_key" ON "GarmentType"("key");

-- CreateIndex
CREATE INDEX "GarmentType_archivedAt_sortOrder_idx" ON "GarmentType"("archivedAt", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionNote_supersedesId_key" ON "CommissionNote"("supersedesId");

-- CreateIndex
CREATE INDEX "CommissionNote_orderId_createdAt_idx" ON "CommissionNote"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "CommissionNote_consultationId_createdAt_idx" ON "CommissionNote"("consultationId", "createdAt");

-- CreateIndex
CREATE INDEX "CostOfProductionLabour_costOfProductionId_idx" ON "CostOfProductionLabour"("costOfProductionId");

-- CreateIndex
CREATE INDEX "CostOfProductionLabour_assignmentId_idx" ON "CostOfProductionLabour"("assignmentId");

-- CreateIndex
CREATE INDEX "WorkLog_day_idx" ON "WorkLog"("day");

-- CreateIndex
CREATE INDEX "WorkLog_orderId_idx" ON "WorkLog"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkLog_assignmentId_day_key" ON "WorkLog"("assignmentId", "day");

-- CreateIndex
CREATE INDEX "BespokeOrder_garmentTypeId_idx" ON "BespokeOrder"("garmentTypeId");

-- AddForeignKey
ALTER TABLE "BespokeOrder" ADD CONSTRAINT "BespokeOrder_garmentTypeId_fkey" FOREIGN KEY ("garmentTypeId") REFERENCES "GarmentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionNote" ADD CONSTRAINT "CommissionNote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BespokeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionNote" ADD CONSTRAINT "CommissionNote_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "ConsultationBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionNote" ADD CONSTRAINT "CommissionNote_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "CommissionNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostOfProductionLabour" ADD CONSTRAINT "CostOfProductionLabour_costOfProductionId_fkey" FOREIGN KEY ("costOfProductionId") REFERENCES "CostOfProduction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostOfProductionLabour" ADD CONSTRAINT "CostOfProductionLabour_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "OrderAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "OrderAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BespokeOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A note sits under a consultation, a commission, or both; never neither.
ALTER TABLE "CommissionNote" ADD CONSTRAINT "CommissionNote_anchor_check"
  CHECK ("orderId" IS NOT NULL OR "consultationId" IS NOT NULL);

-- Append-only, like the store and payment ledgers: a correction is a new row.
CREATE OR REPLACE FUNCTION commission_note_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.ledger_bypass', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION 'Commission notes are append-only: % is not allowed (id=%). Add a correction instead.', TG_OP, OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS commission_note_append_only_trg ON "CommissionNote";
CREATE TRIGGER commission_note_append_only_trg
  BEFORE UPDATE OR DELETE ON "CommissionNote"
  FOR EACH ROW
  EXECUTE PROCEDURE commission_note_append_only();

-- BD1: her words, 12 October. The house adds the rest from the admin.
INSERT INTO "GarmentType" ("id", "key", "label", "sortOrder", "updatedAt") VALUES
    ('bd_garment_wedding_dress',      'wedding_dress',      'Wedding dress',      10, CURRENT_TIMESTAMP),
    ('bd_garment_traditional_outfit', 'traditional_outfit', 'Traditional outfit', 20, CURRENT_TIMESTAMP),
    ('bd_garment_dress',              'dress',              'Dress',              30, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- BD1: commissions converted from an enquiry-led booking get what the enquiry
-- already holds. Convert now copies these; this catches the ones made before.
UPDATE "BespokeOrder" AS bo
SET
  "eventDate"       = COALESCE(bo."eventDate", e."eventDate"),
  "eventLocation"   = COALESCE(bo."eventLocation", NULLIF(TRIM(e."eventLocation"), '')),
  "clientLocation"  = COALESCE(bo."clientLocation",
                        NULLIF(CONCAT_WS(', ', NULLIF(TRIM(e."presentCity"), ''), NULLIF(TRIM(e."presentState"), ''), NULLIF(TRIM(e."presentCountry"), '')), '')),
  "occasionDetails" = CASE
                        WHEN NULLIF(TRIM(e."occasionDetails"), '') IS NOT NULL
                         AND (bo."occasionDetails" IS NULL OR bo."occasionDetails" = bo."occasionType")
                        THEN TRIM(e."occasionDetails")
                        ELSE bo."occasionDetails"
                      END
FROM "ConsultationEnquiry" AS e
WHERE e."bookingId" = bo."consultationId";

-- BD7: from this hour (Lagos) the staff portal asks for the day's entry.
INSERT INTO "SiteSetting" ("id", "key", "value", "group", "label", "type", "isPublic", "sortOrder", "updatedAt") VALUES
  ('bd_workroom_eod_prompt_hour', 'workroom_eod_prompt_hour', '16', 'STORE'::"SettingGroup", 'End-of-day entry: ask from this hour (Lagos, 0–23)', 'NUMBER'::"SettingType", false, 60, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- BD4: 'bespoke.specification' — say what beads and fabric a gown needs, never what it costs.
-- Held by the roles that already run the atelier; granted per person (Maju) from Access.
INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'bd-spec-rp-admin', 'ADMIN', 'bespoke.specification', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'ADMIN')
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'ADMIN' AND "permission" = 'bespoke.specification');

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'bd-spec-rp-staff-admin', 'STAFF_ADMIN', 'bespoke.specification', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'STAFF_ADMIN')
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'STAFF_ADMIN' AND "permission" = 'bespoke.specification');

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt", "updatedAt")
SELECT 'bd-spec-rp-bespoke-manager', 'BESPOKE_MANAGER', 'bespoke.specification', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'BESPOKE_MANAGER')
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" WHERE "role" = 'BESPOKE_MANAGER' AND "permission" = 'bespoke.specification');

-- BD6: open commissions are being cut to her current set today; freeze it onto
-- them so a later commission's measurements cannot move this gown's. Delivered
-- and closed commissions are left empty rather than given a set they were not made to.
UPDATE "BespokeOrder" AS bo
SET
  "measurementsSnapshot" = jsonb_build_object(
    'bust', m."bust", 'waist', m."waist", 'hips', m."hips", 'shoulderWidth', m."shoulderWidth",
    'sleeveLength', m."sleeveLength", 'dressLength', m."dressLength", 'thigh', m."thigh",
    'inseam', m."inseam", 'neck', m."neck", 'armhole', m."armhole",
    'unit', m."unit", 'notes', m."notes", 'values', m."values"
  ),
  "measurementsTakenAt" = m."updatedAt"
FROM "Measurement" AS m
WHERE m."clientId" = bo."clientProfileId"
  AND bo."measurementsSnapshot" IS NULL
  AND bo."status"::text NOT IN ('DELIVERED', 'ARCHIVED', 'CANCELLED');
