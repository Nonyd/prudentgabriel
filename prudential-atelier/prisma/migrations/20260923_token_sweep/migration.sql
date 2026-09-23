-- Token sweep: every secret-in-a-link column onto the AZ3 pattern
-- (src/lib/capability-registry.ts). Random database defaults replace cuid().

-- Staff invitations: store the hash. Pending links keep working until their
-- 72 hours run out, because the lookup hashes what the link carries.
ALTER TABLE "TeamInvitation" ALTER COLUMN "token" SET DEFAULT encode(sha256(convert_to(((gen_random_uuid())::text || (gen_random_uuid())::text), 'UTF8'::name)), 'hex'::text);
UPDATE "TeamInvitation" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex') WHERE "token" !~ '^[0-9a-f]{64}$';

-- Abandoned-checkout restore links: hash + encrypted copy (reminders re-send the
-- same link) + expiry. Existing plaintext rows are hashed and encrypted by
-- scripts/upgrade-capability-tokens.ts, which needs the app's encryption key.
ALTER TABLE "CheckoutSession" ADD COLUMN "restoreTokenEnc" TEXT;
ALTER TABLE "CheckoutSession" ADD COLUMN "restoreTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "CheckoutSession" ALTER COLUMN "restoreToken" SET DEFAULT encode(sha256(convert_to(((gen_random_uuid())::text || (gen_random_uuid())::text), 'UTF8'::name)), 'hex'::text);

-- Unsubscribe links: hash + encrypted copy (every marketing email carries it).
ALTER TABLE "EmailPreference" ADD COLUMN "unsubscribeTokenEnc" TEXT;
ALTER TABLE "EmailPreference" ALTER COLUMN "unsubscribeToken" SET DEFAULT encode(sha256(convert_to(((gen_random_uuid())::text || (gen_random_uuid())::text), 'UTF8'::name)), 'hex'::text);
