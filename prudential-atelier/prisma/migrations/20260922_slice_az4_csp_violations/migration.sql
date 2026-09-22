-- Slice AZ4: aggregated CSP report-only violations (no user data).
CREATE TABLE IF NOT EXISTS "CspViolation" (
    "id" TEXT NOT NULL,
    "directive" TEXT NOT NULL,
    "blockedOrigin" TEXT NOT NULL,
    "documentPath" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CspViolation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CspViolation_directive_blockedOrigin_documentPath_key"
    ON "CspViolation"("directive", "blockedOrigin", "documentPath");
CREATE INDEX IF NOT EXISTS "CspViolation_lastSeenAt_idx" ON "CspViolation"("lastSeenAt");
