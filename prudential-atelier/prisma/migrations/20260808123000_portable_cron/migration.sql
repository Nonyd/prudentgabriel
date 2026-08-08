-- Sprint C0: portable cron infrastructure (CronRun) + resumable job markers
--
-- ADD VALUE on pre-existing enums is transaction-safe on PG 16+, but the new
-- labels cannot be *used* (DEFAULT / CHECK / INSERT) until commit. This file
-- only adds values; application code uses them after deploy.
-- New enum type CronRunStatus may include all labels in CREATE TYPE.

ALTER TYPE "AdminNotificationType" ADD VALUE IF NOT EXISTS 'QUOTE_AWAITING';
ALTER TYPE "StaffNotificationType" ADD VALUE IF NOT EXISTS 'QUOTE_AWAITING';

CREATE TYPE "CronRunStatus" AS ENUM ('RUNNING', 'OK', 'FAILED', 'TIMED_OUT');

CREATE TABLE "CronRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "CronRunStatus" NOT NULL DEFAULT 'RUNNING',
    "processed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "host" TEXT,

    CONSTRAINT "CronRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CronRun_job_startedAt_idx" ON "CronRun"("job", "startedAt");
CREATE INDEX "CronRun_status_startedAt_idx" ON "CronRun"("status", "startedAt");

ALTER TABLE "ConsultationBooking" ADD COLUMN IF NOT EXISTS "quoteAlertSentAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "ConsultationBooking_status_quoteAlertSentAt_completedAt_idx"
  ON "ConsultationBooking"("status", "quoteAlertSentAt", "completedAt");

ALTER TABLE "BespokeOrder" ADD COLUMN IF NOT EXISTS "balanceReminderSentAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "BespokeOrder_balance_balanceReminderSentAt_deliveryDate_idx"
  ON "BespokeOrder"("balance", "balanceReminderSentAt", "deliveryDate");
