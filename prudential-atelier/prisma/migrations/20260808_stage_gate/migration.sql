-- Sprint B: stage-gate engine (completion records, stage-scoped media, client approval)
--
-- ADD VALUE on pre-existing enums is transaction-safe on PG 16, but the new
-- labels cannot be *used* (DEFAULT / CHECK / INSERT) until commit. This file
-- only adds values; application code uses them after deploy.
-- New enum *types* (StageApprovalStatus, StageMediaKind) may include all
-- labels in CREATE TYPE — that is not an ADD VALUE.

ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'STAGE_REVERT';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'STAGE_APPROVAL_REQUEST';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PRODUCTION_RELOCK';
ALTER TYPE "AdminNotificationType" ADD VALUE IF NOT EXISTS 'STAGE_APPROVAL_RESPONSE';
ALTER TYPE "AdminNotificationType" ADD VALUE IF NOT EXISTS 'PRODUCTION_RELOCKED';
ALTER TYPE "CustomerNotificationType" ADD VALUE IF NOT EXISTS 'STAGE_APPROVAL_REQUESTED';
ALTER TYPE "CustomerNotificationType" ADD VALUE IF NOT EXISTS 'STAGE_CHANGES_REQUESTED';

CREATE TYPE "StageApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'SUPERSEDED');
CREATE TYPE "StageMediaKind" AS ENUM ('IMAGE', 'VIDEO');

CREATE TABLE "OrderStageCompletion" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stage" "BespokeStage" NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedById" TEXT NOT NULL,
    "notes" TEXT,
    "revertedAt" TIMESTAMP(3),
    "revertedById" TEXT,
    "revertReason" TEXT,

    CONSTRAINT "OrderStageCompletion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderStageCompletion_orderId_stage_idx" ON "OrderStageCompletion"("orderId", "stage");
CREATE INDEX "OrderStageCompletion_orderId_revertedAt_idx" ON "OrderStageCompletion"("orderId", "revertedAt");

CREATE TABLE "OrderStageMedia" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stage" "BespokeStage" NOT NULL,
    "url" TEXT NOT NULL,
    "kind" "StageMediaKind" NOT NULL DEFAULT 'IMAGE',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStageMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderStageMedia_orderId_stage_idx" ON "OrderStageMedia"("orderId", "stage");

CREATE TABLE "OrderStageDraft" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stage" "BespokeStage" NOT NULL,
    "notes" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderStageDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderStageDraft_orderId_stage_key" ON "OrderStageDraft"("orderId", "stage");

CREATE TABLE "StageApproval" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stage" "BespokeStage" NOT NULL,
    "status" "StageApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "clientComment" TEXT,
    "reminderSentAt" TIMESTAMP(3),

    CONSTRAINT "StageApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StageApproval_orderId_stage_idx" ON "StageApproval"("orderId", "stage");
CREATE INDEX "StageApproval_status_requestedAt_idx" ON "StageApproval"("status", "requestedAt");

ALTER TABLE "OrderStageCompletion" ADD CONSTRAINT "OrderStageCompletion_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BespokeOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderStageCompletion" ADD CONSTRAINT "OrderStageCompletion_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderStageCompletion" ADD CONSTRAINT "OrderStageCompletion_revertedById_fkey" FOREIGN KEY ("revertedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderStageMedia" ADD CONSTRAINT "OrderStageMedia_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BespokeOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderStageMedia" ADD CONSTRAINT "OrderStageMedia_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderStageDraft" ADD CONSTRAINT "OrderStageDraft_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BespokeOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StageApproval" ADD CONSTRAINT "StageApproval_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BespokeOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
