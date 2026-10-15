-- Birthday without the year, on every user (clients, staff, admins), for birthday wishes.
ALTER TABLE "User" ADD COLUMN "birthdayDay" INTEGER;
ALTER TABLE "User" ADD COLUMN "birthdayMonth" INTEGER;
ALTER TABLE "User" ADD COLUMN "birthdayWishedYear" INTEGER;

ALTER TABLE "User" ADD CONSTRAINT "User_birthday_check" CHECK (
  ("birthdayDay" IS NULL AND "birthdayMonth" IS NULL)
  OR ("birthdayDay" BETWEEN 1 AND 31 AND "birthdayMonth" BETWEEN 1 AND 12)
);

-- Clients who already gave a full date of birth keep their birthday.
UPDATE "User" u
SET "birthdayDay" = EXTRACT(DAY FROM cp."dateOfBirth")::INTEGER,
    "birthdayMonth" = EXTRACT(MONTH FROM cp."dateOfBirth")::INTEGER
FROM "ClientProfile" cp
WHERE cp."userId" = u."id" AND cp."dateOfBirth" IS NOT NULL AND u."birthdayDay" IS NULL;

ALTER TYPE "CustomerNotificationType" ADD VALUE IF NOT EXISTS 'BIRTHDAY';
ALTER TYPE "StaffNotificationType" ADD VALUE IF NOT EXISTS 'BIRTHDAY';
