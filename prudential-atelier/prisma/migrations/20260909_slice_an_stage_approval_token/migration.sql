-- Slice AN: public token for stage approval, same pattern as quote / invoice.
ALTER TABLE "StageApproval" ADD COLUMN IF NOT EXISTS "publicToken" TEXT;

UPDATE "StageApproval"
SET "publicToken" = "id"
WHERE "publicToken" IS NULL;

ALTER TABLE "StageApproval" ALTER COLUMN "publicToken" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "StageApproval_publicToken_key" ON "StageApproval"("publicToken");
