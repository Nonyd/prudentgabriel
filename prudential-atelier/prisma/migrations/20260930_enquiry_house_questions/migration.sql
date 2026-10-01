-- The consultation enquiry asks the house's questions (30 September 2026):
-- the occasion, number of dresses, where the event is, where she lives now,
-- fitting availability, when she needs the dress, and her colour palette.
-- The retired screening answers (who will wear it, what kind of outfit) stay on
-- older enquiries and become optional for new ones. Nothing is dropped.

-- AlterTable
ALTER TABLE "ConsultationEnquiry" ALTER COLUMN "wearer" DROP NOT NULL,
ALTER COLUMN "outfitType" DROP NOT NULL,
ADD COLUMN "occasionDetails" TEXT,
ADD COLUMN "dressCount" INTEGER,
ADD COLUMN "eventLocation" TEXT,
ADD COLUMN "presentCity" TEXT,
ADD COLUMN "presentState" TEXT,
ADD COLUMN "presentCountry" TEXT,
ADD COLUMN "fittingMode" TEXT,
ADD COLUMN "fittingNote" TEXT,
ADD COLUMN "deliveryDate" DATE,
ADD COLUMN "colourPalette" TEXT;
