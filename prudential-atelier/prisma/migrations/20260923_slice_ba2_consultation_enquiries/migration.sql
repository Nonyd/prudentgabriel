-- Slice BA2: consultations become invitations. An enquiry is screened and
-- approved before a booking link (AZ3 capability token) is issued; the booking
-- snapshots the non-refundable terms the client acknowledged.
-- CreateEnum
CREATE TYPE "ConsultationEnquiryStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'BOOKED');

-- AlterTable
ALTER TABLE "ConsultationBooking" ADD COLUMN     "legalTermsSnapshot" JSONB,
ADD COLUMN     "legalTermsVersion" TEXT,
ADD COLUMN     "termsAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "termsText" TEXT;

-- CreateTable
CREATE TABLE "ConsultationEnquiry" (
    "id" TEXT NOT NULL,
    "enquiryNumber" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "eventType" TEXT NOT NULL,
    "wearer" TEXT NOT NULL,
    "outfitType" TEXT NOT NULL,
    "notes" TEXT,
    "moodboardImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shortNotice" BOOLEAN NOT NULL DEFAULT false,
    "status" "ConsultationEnquiryStatus" NOT NULL DEFAULT 'PENDING',
    "decisionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "publicToken" TEXT NOT NULL DEFAULT encode(sha256(convert_to(((gen_random_uuid())::text || (gen_random_uuid())::text), 'UTF8'::name)), 'hex'::text),
    "publicTokenEnc" TEXT,
    "publicTokenExpiresAt" TIMESTAMP(3),
    "bookingId" TEXT,
    "overdueAlertSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationEnquiry_enquiryNumber_key" ON "ConsultationEnquiry"("enquiryNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationEnquiry_publicToken_key" ON "ConsultationEnquiry"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationEnquiry_bookingId_key" ON "ConsultationEnquiry"("bookingId");

-- CreateIndex
CREATE INDEX "ConsultationEnquiry_status_createdAt_idx" ON "ConsultationEnquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationEnquiry_clientEmail_idx" ON "ConsultationEnquiry"("clientEmail");

-- AddForeignKey
ALTER TABLE "ConsultationEnquiry" ADD CONSTRAINT "ConsultationEnquiry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ConsultationBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
