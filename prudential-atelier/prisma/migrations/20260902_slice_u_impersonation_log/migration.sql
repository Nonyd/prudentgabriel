-- Slice U: ActivityLog records both identities while a Super Admin is viewing as a user.
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "impersonatedUserId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "impersonatedEmail" TEXT;
