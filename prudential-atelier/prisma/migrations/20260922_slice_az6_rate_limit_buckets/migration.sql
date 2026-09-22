-- Slice AZ6: persisted rate-limit counters (were an in-memory Map per process).
CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");
