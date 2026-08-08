-- CronRun.hasMore: OK runs that stopped early on the time budget leave a
-- backlog signal without looking like TIMED_OUT / FAILED.

ALTER TABLE "CronRun" ADD COLUMN IF NOT EXISTS "hasMore" BOOLEAN NOT NULL DEFAULT false;
