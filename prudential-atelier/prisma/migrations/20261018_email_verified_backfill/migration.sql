-- Email verification ships with this release. Accounts that already exist are
-- treated as verified (decided 15 October 2026); only new sign-ups must confirm.
UPDATE "User" SET "emailVerified" = "createdAt" WHERE "emailVerified" IS NULL;
