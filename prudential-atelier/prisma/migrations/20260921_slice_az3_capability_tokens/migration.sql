-- Slice AZ3: capability tokens — hash in public columns, optional encrypted raw for re-send,
-- nullable expiresAt (NULL = grandfathered cuid / open-ended).
-- Existing cuid values stay in the token columns and keep working without expiry.

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "publicTokenEnc" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "publicTokenExpiresAt" TIMESTAMP(3);

ALTER TABLE "BespokeOrder" ADD COLUMN IF NOT EXISTS "trackingTokenEnc" TEXT;
ALTER TABLE "BespokeOrder" ADD COLUMN IF NOT EXISTS "trackingTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "BespokeOrder" ADD COLUMN IF NOT EXISTS "receiptConfirmTokenEnc" TEXT;
ALTER TABLE "BespokeOrder" ADD COLUMN IF NOT EXISTS "receiptConfirmTokenExpiresAt" TIMESTAMP(3);

ALTER TABLE "StageApproval" ADD COLUMN IF NOT EXISTS "publicTokenEnc" TEXT;
ALTER TABLE "StageApproval" ADD COLUMN IF NOT EXISTS "publicTokenExpiresAt" TIMESTAMP(3);

ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "approvalTokenEnc" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "approvalTokenExpiresAt" TIMESTAMP(3);
