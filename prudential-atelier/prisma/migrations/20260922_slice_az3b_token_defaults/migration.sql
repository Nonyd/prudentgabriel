-- Slice AZ3 follow-up: capability-token columns no longer default to a cuid.
-- Prisma generated @default(cuid()) client-side, so any create that omitted the
-- token got a plaintext, guessable, non-expiring link. The default is now a
-- database-generated SHA-256 of fresh random UUIDs: the same shape as a real
-- stored hash, matched by no raw token, so such a row has no working link until
-- the app issues one (ensure*Raw). gen_random_uuid() is built in since PG 13.
ALTER TABLE "Invoice" ALTER COLUMN "publicToken"
  SET DEFAULT encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex');
ALTER TABLE "BespokeOrder" ALTER COLUMN "trackingToken"
  SET DEFAULT encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex');
ALTER TABLE "BespokeOrder" ALTER COLUMN "receiptConfirmToken"
  SET DEFAULT encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex');
ALTER TABLE "StageApproval" ALTER COLUMN "publicToken"
  SET DEFAULT encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex');
ALTER TABLE "Quotation" ALTER COLUMN "approvalToken"
  SET DEFAULT encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex');
