-- At most one live (non-reverted) completion per order+stage.
-- Prisma cannot express partial unique indexes in schema.prisma; without this,
-- dropping @@unique([orderId, stage]) would leave the invariant as intent only.
-- Reverted rows keep their history; a new live completion may coexist with them.
CREATE UNIQUE INDEX "OrderStageCompletion_orderId_stage_live_key"
ON "OrderStageCompletion"("orderId", "stage")
WHERE "revertedAt" IS NULL;
