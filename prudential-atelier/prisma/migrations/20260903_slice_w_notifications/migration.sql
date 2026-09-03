-- Slice W: per-user admin read state, targeting, ack, split types, drop dead enums.

DELETE FROM "AdminNotification" WHERE type::text = 'COUPON_EXPIRING';
DELETE FROM "CustomerNotification" WHERE type::text IN ('STAGE_CHANGES_REQUESTED', 'ALTERATION_UPDATE');
DELETE FROM "StaffNotification" WHERE type::text IN ('STAGE_REASSIGNED', 'JOB_ASSIGNED', 'TASK_ASSIGNED', 'SCHEDULE', 'GENERAL');

CREATE TYPE "AdminNotificationType_new" AS ENUM (
  'NEW_ORDER',
  'BANK_TRANSFER_RECEIPT',
  'NEW_BESPOKE',
  'QUOTE_APPROVED',
  'STAGE_COMPLETED',
  'PRODUCTION_UNLOCKED',
  'NEW_CONSULTATION',
  'CONSULTATION_COMPLETED',
  'CONSULTATION_BOOKED_PRUDENT',
  'REVIEW_PENDING',
  'TESTIMONIAL_SUBMITTED',
  'LOW_STOCK',
  'PAYMENT_FAILED',
  'RTW_OVERSELL',
  'NEW_CUSTOMER',
  'CONTACT_FORM',
  'JOB_APPLICATION',
  'STAGE_APPROVAL_RESPONSE',
  'PRODUCTION_RELOCKED',
  'QUOTE_AWAITING',
  'EMAIL_DEAD',
  'EMAIL_PROVIDER_AUTH'
);

ALTER TABLE "AdminNotification"
  ALTER COLUMN "type" TYPE "AdminNotificationType_new"
  USING ("type"::text::"AdminNotificationType_new");

DROP TYPE "AdminNotificationType";
ALTER TYPE "AdminNotificationType_new" RENAME TO "AdminNotificationType";

CREATE TYPE "CustomerNotificationType_new" AS ENUM (
  'CONSULTATION_CONFIRMED',
  'MEETING_LINK_SENT',
  'ATELIER_STAGE_ADVANCED',
  'MOODBOARD_READY',
  'INVOICE_ISSUED',
  'QUOTE_READY',
  'PAYMENT_CONFIRMED',
  'BALANCE_REMINDER',
  'ORDER_SHIPPED',
  'ORDER_DELIVERED',
  'REVIEW_REQUEST',
  'LOYALTY_TIER_UPGRADE',
  'EVENT_REMINDER',
  'REFERRAL_REWARD',
  'ORDER_CONFIRMED',
  'BANK_TRANSFER_CONFIRMED',
  'STAGE_APPROVAL_REQUESTED',
  'RECEIPT_CONFIRMATION_REQUESTED',
  'RECEIPT_CONFIRMED'
);

ALTER TABLE "CustomerNotification"
  ALTER COLUMN "type" TYPE "CustomerNotificationType_new"
  USING ("type"::text::"CustomerNotificationType_new");

DROP TYPE "CustomerNotificationType";
ALTER TYPE "CustomerNotificationType_new" RENAME TO "CustomerNotificationType";

CREATE TYPE "StaffNotificationType_new" AS ENUM (
  'STAGE_ASSIGNED',
  'ORDER_UPDATE',
  'LATE_ALERT',
  'QUOTE_AWAITING'
);

ALTER TABLE "StaffNotification"
  ALTER COLUMN "type" TYPE "StaffNotificationType_new"
  USING ("type"::text::"StaffNotificationType_new");

DROP TYPE "StaffNotificationType";
ALTER TYPE "StaffNotificationType_new" RENAME TO "StaffNotificationType";

ALTER TABLE "AdminNotification"
  ADD COLUMN IF NOT EXISTS "targetPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "acknowledgedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "acknowledgedById" TEXT;

CREATE TABLE IF NOT EXISTS "AdminNotificationRead" (
  "userId" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminNotificationRead_pkey" PRIMARY KEY ("userId", "notificationId")
);

CREATE INDEX IF NOT EXISTS "AdminNotificationRead_userId_readAt_idx"
  ON "AdminNotificationRead"("userId", "readAt");

ALTER TABLE "AdminNotificationRead"
  DROP CONSTRAINT IF EXISTS "AdminNotificationRead_userId_fkey",
  ADD CONSTRAINT "AdminNotificationRead_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminNotificationRead"
  DROP CONSTRAINT IF EXISTS "AdminNotificationRead_notificationId_fkey",
  ADD CONSTRAINT "AdminNotificationRead_notificationId_fkey"
    FOREIGN KEY ("notificationId") REFERENCES "AdminNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminNotification"
  DROP CONSTRAINT IF EXISTS "AdminNotification_acknowledgedById_fkey",
  ADD CONSTRAINT "AdminNotification_acknowledgedById_fkey"
    FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "AdminNotification_isRead_createdAt_idx";
CREATE INDEX IF NOT EXISTS "AdminNotification_createdAt_idx" ON "AdminNotification"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminNotification_acknowledgedAt_idx" ON "AdminNotification"("acknowledgedAt");

-- Historic rows: keep them visible to the portal rather than hiding them behind new targeting.
UPDATE "AdminNotification"
SET "targetPermissions" = ARRAY['*']::TEXT[]
WHERE cardinality("targetPermissions") = 0;

-- Existing oversell bells were filed as PAYMENT_FAILED.
UPDATE "AdminNotification"
SET type = 'RTW_OVERSELL'
WHERE type = 'PAYMENT_FAILED' AND title ILIKE '%oversell%';

ALTER TABLE "EventDate"
  ADD COLUMN IF NOT EXISTS "remindersSent" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

INSERT INTO "SiteSetting" ("id", "key", "value", "group", "label", "type", "isPublic", "sortOrder", "updatedAt")
SELECT 'ss-w-hr-alert-email', 'hr_alert_email', '', 'EMAIL', 'HR alert email', 'TEXT', false, 14, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "SiteSetting" WHERE "key" = 'hr_alert_email');

UPDATE "SiteSetting"
SET "label" = 'Operational alert email'
WHERE "key" = 'admin_notification_email';
