-- A saved card's Paystack authorisation code is encrypted at rest.
-- The app's key is not available to SQL: scripts/upgrade-capability-tokens.ts
-- (run by the entrypoint) moves existing codes into paystackAuthCodeEnc and
-- nulls the plaintext column. The unique index on the plaintext code goes; the
-- app de-duplicates a customer's cards by decrypting her own few.
DROP INDEX IF EXISTS "SavedPaymentMethod_userId_gateway_paystackAuthCode_key";
ALTER TABLE "SavedPaymentMethod" ADD COLUMN "paystackAuthCodeEnc" TEXT;
