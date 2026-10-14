-- Change requests from the client quote page: recorded on the quotation, answered by the house.
ALTER TYPE "AdminNotificationType" ADD VALUE IF NOT EXISTS 'QUOTE_CHANGES_REQUESTED';

-- CreateTable
CREATE TABLE "QuotationChangeRequest" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedBy" TEXT,

    CONSTRAINT "QuotationChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuotationChangeRequest_quotationId_createdAt_idx" ON "QuotationChangeRequest"("quotationId", "createdAt");

-- AddForeignKey
ALTER TABLE "QuotationChangeRequest" ADD CONSTRAINT "QuotationChangeRequest_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
