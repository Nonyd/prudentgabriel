-- Marketing email is opt-in only (NDPA 2023 / GDPR, decided October 2026).
-- Existing accounts have NOT opted in: their consent stays null. The one
-- exception is an account whose email is on the newsletter list and has not
-- unsubscribed: she asked for the newsletter, so that sign-up is her consent.

ALTER TABLE "User" ADD COLUMN "marketingConsentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "marketingConsentSource" TEXT;

ALTER TABLE "NewsletterSubscriber" ADD COLUMN "consentAt" TIMESTAMP(3);
ALTER TABLE "NewsletterSubscriber" ADD COLUMN "consentSource" TEXT;

-- Every row on the list arrived through the newsletter form: that was the consent.
UPDATE "NewsletterSubscriber"
SET "consentAt" = "createdAt", "consentSource" = 'newsletter'
WHERE "consentAt" IS NULL;

-- Accounts whose email is an active subscriber.
UPDATE "User" u
SET "marketingConsentAt" = n."createdAt", "marketingConsentSource" = 'newsletter'
FROM "NewsletterSubscriber" n
WHERE lower(n."email") = lower(u."email")
  AND n."unsubscribedAt" IS NULL
  AND u."marketingConsentAt" IS NULL;
