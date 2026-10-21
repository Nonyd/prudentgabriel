-- Each commission gets its own steps: the thirteen built-in ones to start, which the
-- house can then move, skip, add to and run side by side. Child rows (completions,
-- media, drafts, approvals, timeline, assignments) point at the step, not the stage.

CREATE TYPE "OrderStageStatus" AS ENUM ('PENDING', 'ACTIVE', 'DONE', 'SKIPPED');

CREATE TABLE "OrderStage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "stage" "BespokeStage" NOT NULL,
    "label" TEXT,
    "clientDescription" TEXT,
    "status" "OrderStageStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "startedById" TEXT,
    "skippedAt" TIMESTAMP(3),
    "skippedById" TEXT,
    "skippedReason" TEXT,
    "requiresNotes" BOOLEAN NOT NULL DEFAULT true,
    "minMediaCount" INTEGER NOT NULL DEFAULT 0,
    "requiresClientApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderStage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderStage_orderId_position_key" ON "OrderStage"("orderId", "position");
CREATE INDEX "OrderStage_orderId_status_idx" ON "OrderStage"("orderId", "status");
-- Each built-in step at most once per order; any number of CUSTOM steps.
CREATE UNIQUE INDEX "OrderStage_orderId_stage_builtin_key"
ON "OrderStage"("orderId", "stage")
WHERE "stage" <> 'CUSTOM';

ALTER TABLE "OrderStage" ADD CONSTRAINT "OrderStage_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "BespokeOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every order gets the thirteen built-in steps in STAGE_ORDER (the enum's
-- declaration order). A step is DONE when it has a live completion, or sits before
-- currentStage (the old isStageCompleted rule, for orders older than completions);
-- currentStage is ACTIVE; the rest wait.
INSERT INTO "OrderStage" ("id", "orderId", "position", "stage", "status", "startedAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    o."id",
    s.n,
    s.stage,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM "OrderStageCompletion" c
            WHERE c."orderId" = o."id" AND c."stage" = s.stage AND c."revertedAt" IS NULL
        ) THEN 'DONE'::"OrderStageStatus"
        WHEN s.n < cur.n THEN 'DONE'::"OrderStageStatus"
        WHEN s.n = cur.n THEN 'ACTIVE'::"OrderStageStatus"
        ELSE 'PENDING'::"OrderStageStatus"
    END,
    CASE WHEN s.n <= cur.n THEN CURRENT_TIMESTAMP END,
    CURRENT_TIMESTAMP
FROM "BespokeOrder" o
CROSS JOIN LATERAL (
    SELECT e.stage, e.n::int AS n
    FROM unnest(enum_range(NULL::"BespokeStage")) WITH ORDINALITY AS e(stage, n)
    WHERE e.stage <> 'CUSTOM'
) s
CROSS JOIN LATERAL (
    SELECT e.n::int AS n
    FROM unnest(enum_range(NULL::"BespokeStage")) WITH ORDINALITY AS e(stage, n)
    WHERE e.stage = o."currentStage"
) cur;

-- Child rows: add the step link, fill it from (orderId, stage), then require it.
ALTER TABLE "OrderStageCompletion" ADD COLUMN "orderStageId" TEXT;
ALTER TABLE "OrderStageMedia" ADD COLUMN "orderStageId" TEXT;
ALTER TABLE "OrderStageDraft" ADD COLUMN "orderStageId" TEXT;
ALTER TABLE "StageApproval" ADD COLUMN "orderStageId" TEXT;
ALTER TABLE "StageUpdate" ADD COLUMN "orderStageId" TEXT;
ALTER TABLE "OrderAssignment" ADD COLUMN "orderStageId" TEXT;

UPDATE "OrderStageCompletion" t SET "orderStageId" = os."id"
FROM "OrderStage" os WHERE os."orderId" = t."orderId" AND os."stage" = t."stage";
UPDATE "OrderStageMedia" t SET "orderStageId" = os."id"
FROM "OrderStage" os WHERE os."orderId" = t."orderId" AND os."stage" = t."stage";
UPDATE "OrderStageDraft" t SET "orderStageId" = os."id"
FROM "OrderStage" os WHERE os."orderId" = t."orderId" AND os."stage" = t."stage";
UPDATE "StageApproval" t SET "orderStageId" = os."id"
FROM "OrderStage" os WHERE os."orderId" = t."orderId" AND os."stage" = t."stage";
UPDATE "StageUpdate" t SET "orderStageId" = os."id"
FROM "OrderStage" os WHERE os."orderId" = t."orderId" AND os."stage" = t."stage";
UPDATE "OrderAssignment" t SET "orderStageId" = os."id"
FROM "OrderStage" os WHERE t."stage" IS NOT NULL AND os."orderId" = t."orderId" AND os."stage" = t."stage";

ALTER TABLE "OrderStageCompletion" ALTER COLUMN "orderStageId" SET NOT NULL;
ALTER TABLE "OrderStageMedia" ALTER COLUMN "orderStageId" SET NOT NULL;
ALTER TABLE "OrderStageDraft" ALTER COLUMN "orderStageId" SET NOT NULL;
ALTER TABLE "StageApproval" ALTER COLUMN "orderStageId" SET NOT NULL;
ALTER TABLE "StageUpdate" ALTER COLUMN "orderStageId" SET NOT NULL;

-- Uniqueness moves from (orderId, stage) to the step.
DROP INDEX "OrderStageCompletion_orderId_stage_live_key";
CREATE UNIQUE INDEX "OrderStageCompletion_orderStageId_live_key"
ON "OrderStageCompletion"("orderStageId")
WHERE "revertedAt" IS NULL;

DROP INDEX "OrderStageDraft_orderId_stage_key";
CREATE UNIQUE INDEX "OrderStageDraft_orderStageId_key" ON "OrderStageDraft"("orderStageId");
CREATE INDEX "OrderStageDraft_orderId_stage_idx" ON "OrderStageDraft"("orderId", "stage");

CREATE INDEX "OrderStageCompletion_orderStageId_idx" ON "OrderStageCompletion"("orderStageId");
CREATE INDEX "OrderStageMedia_orderStageId_idx" ON "OrderStageMedia"("orderStageId");
CREATE INDEX "StageApproval_orderStageId_idx" ON "StageApproval"("orderStageId");
CREATE INDEX "StageUpdate_orderStageId_idx" ON "StageUpdate"("orderStageId");
CREATE INDEX "OrderAssignment_orderStageId_idx" ON "OrderAssignment"("orderStageId");

ALTER TABLE "OrderStageCompletion" ADD CONSTRAINT "OrderStageCompletion_orderStageId_fkey"
FOREIGN KEY ("orderStageId") REFERENCES "OrderStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderStageMedia" ADD CONSTRAINT "OrderStageMedia_orderStageId_fkey"
FOREIGN KEY ("orderStageId") REFERENCES "OrderStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderStageDraft" ADD CONSTRAINT "OrderStageDraft_orderStageId_fkey"
FOREIGN KEY ("orderStageId") REFERENCES "OrderStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StageApproval" ADD CONSTRAINT "StageApproval_orderStageId_fkey"
FOREIGN KEY ("orderStageId") REFERENCES "OrderStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StageUpdate" ADD CONSTRAINT "StageUpdate_orderStageId_fkey"
FOREIGN KEY ("orderStageId") REFERENCES "OrderStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderAssignment" ADD CONSTRAINT "OrderAssignment_orderStageId_fkey"
FOREIGN KEY ("orderStageId") REFERENCES "OrderStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
