-- Slice P: bank accounts by currency and business line.

CREATE TYPE "BankAccountCurrency" AS ENUM ('NGN', 'USD', 'GBP', 'EUR');
CREATE TYPE "BusinessLine" AS ENUM ('RTW', 'ATELIER');
CREATE TYPE "WireFeeBearer" AS ENUM ('CUSTOMER', 'HOUSE', 'SHARED');

CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "currency" "BankAccountCurrency" NOT NULL,
    "businessLine" "BusinessLine" NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "swiftBic" TEXT,
    "iban" TEXT,
    "sortCode" TEXT,
    "routingNumber" TEXT,
    "intermediaryBank" TEXT,
    "instructions" TEXT,
    "feeBearer" "WireFeeBearer",
    "feeTolerance" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankAccount_currency_businessLine_key" ON "BankAccount"("currency", "businessLine");
CREATE INDEX "BankAccount_isActive_currency_businessLine_idx" ON "BankAccount"("isActive", "currency", "businessLine");

ALTER TABLE "Quotation" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NGN';

-- Copy Slice K payment settings into RTW rows. Skip dummy / empty numbers.
INSERT INTO "BankAccount" (
  "id", "currency", "businessLine", "accountName", "accountNumber", "bankName",
  "isActive", "createdAt", "updatedAt"
)
SELECT
  'ba_rtw_ngn',
  'NGN'::"BankAccountCurrency",
  'RTW'::"BusinessLine",
  COALESCE(NULLIF(trim(name.val), ''), 'Prudential Atelier Limited'),
  trim(num.val),
  COALESCE(NULLIF(trim(bank.val), ''), 'Guaranty Trust Bank'),
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM
  (SELECT value AS val FROM "SiteSetting" WHERE key = 'bank_account_number' LIMIT 1) num
  CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT value FROM "SiteSetting" WHERE key = 'bank_account_name' LIMIT 1), '') AS val
  ) name
  CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT value FROM "SiteSetting" WHERE key = 'bank_name' LIMIT 1), '') AS val
  ) bank
WHERE trim(num.val) <> '' AND trim(num.val) <> '0123456789'
ON CONFLICT ("currency", "businessLine") DO NOTHING;

INSERT INTO "BankAccount" (
  "id", "currency", "businessLine", "accountName", "accountNumber", "bankName",
  "isActive", "createdAt", "updatedAt"
)
SELECT
  'ba_rtw_usd',
  'USD'::"BankAccountCurrency",
  'RTW'::"BusinessLine",
  COALESCE(NULLIF(trim(name.val), ''), ''),
  trim(num.val),
  COALESCE(NULLIF(trim(bank.val), ''), ''),
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM
  (SELECT value AS val FROM "SiteSetting" WHERE key = 'bank_account_number_usd' LIMIT 1) num
  CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT value FROM "SiteSetting" WHERE key = 'bank_account_name_usd' LIMIT 1), '') AS val
  ) name
  CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT value FROM "SiteSetting" WHERE key = 'bank_name_usd' LIMIT 1), '') AS val
  ) bank
WHERE trim(num.val) <> '' AND trim(num.val) <> '0123456789'
ON CONFLICT ("currency", "businessLine") DO NOTHING;

-- Invoice settings become ATELIER rows (atelier quotations / invoices / bookings).
INSERT INTO "BankAccount" (
  "id", "currency", "businessLine", "accountName", "accountNumber", "bankName",
  "swiftBic", "sortCode", "isActive", "createdAt", "updatedAt"
)
SELECT
  'ba_atelier_ngn',
  'NGN'::"BankAccountCurrency",
  'ATELIER'::"BusinessLine",
  COALESCE(NULLIF(trim(name.val), ''), ''),
  trim(num.val),
  COALESCE(NULLIF(trim(bank.val), ''), ''),
  NULL,
  NULL,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM
  (SELECT value AS val FROM "SiteSetting" WHERE key = 'invoice_account_number_ngn' LIMIT 1) num
  CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT value FROM "SiteSetting" WHERE key = 'invoice_account_name_ngn' LIMIT 1), '') AS val
  ) name
  CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT value FROM "SiteSetting" WHERE key = 'invoice_bank_name_ngn' LIMIT 1), '') AS val
  ) bank
WHERE trim(num.val) <> '' AND trim(num.val) <> '0123456789' AND trim(num.val) <> '0000000000'
ON CONFLICT ("currency", "businessLine") DO NOTHING;

INSERT INTO "BankAccount" (
  "id", "currency", "businessLine", "accountName", "accountNumber", "bankName",
  "swiftBic", "sortCode", "isActive", "createdAt", "updatedAt"
)
SELECT
  'ba_atelier_usd',
  'USD'::"BankAccountCurrency",
  'ATELIER'::"BusinessLine",
  COALESCE(NULLIF(trim(name.val), ''), ''),
  trim(num.val),
  COALESCE(NULLIF(trim(bank.val), ''), ''),
  NULLIF(trim(swift.val), ''),
  NULLIF(trim(sortc.val), ''),
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM
  (SELECT value AS val FROM "SiteSetting" WHERE key = 'invoice_account_number_usd' LIMIT 1) num
  CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT value FROM "SiteSetting" WHERE key = 'invoice_account_name_usd' LIMIT 1), '') AS val
  ) name
  CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT value FROM "SiteSetting" WHERE key = 'invoice_bank_name_usd' LIMIT 1), '') AS val
  ) bank
  CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT value FROM "SiteSetting" WHERE key = 'invoice_swift_usd' LIMIT 1), '') AS val
  ) swift
  CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT value FROM "SiteSetting" WHERE key = 'invoice_sort_code_usd' LIMIT 1), '') AS val
  ) sortc
WHERE trim(num.val) <> '' AND trim(num.val) <> '0123456789' AND trim(num.val) <> '0000000000'
ON CONFLICT ("currency", "businessLine") DO NOTHING;

INSERT INTO "BankAccount" (
  "id", "currency", "businessLine", "accountName", "accountNumber", "bankName",
  "sortCode", "isActive", "createdAt", "updatedAt"
)
SELECT
  'ba_atelier_gbp',
  'GBP'::"BankAccountCurrency",
  'ATELIER'::"BusinessLine",
  COALESCE(NULLIF(trim(name.val), ''), ''),
  trim(num.val),
  COALESCE(NULLIF(trim(bank.val), ''), ''),
  NULLIF(trim(sortc.val), ''),
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM
  (SELECT value AS val FROM "SiteSetting" WHERE key = 'invoice_account_number_gbp' LIMIT 1) num
  CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT value FROM "SiteSetting" WHERE key = 'invoice_account_name_gbp' LIMIT 1), '') AS val
  ) name
  CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT value FROM "SiteSetting" WHERE key = 'invoice_bank_name_gbp' LIMIT 1), '') AS val
  ) bank
  CROSS JOIN LATERAL (
    SELECT COALESCE((SELECT value FROM "SiteSetting" WHERE key = 'invoice_sort_code_gbp' LIMIT 1), '') AS val
  ) sortc
WHERE trim(num.val) <> '' AND trim(num.val) <> '0123456789' AND trim(num.val) <> '0000000000'
ON CONFLICT ("currency", "businessLine") DO NOTHING;

-- If atelier NGN/USD were never filled, copy the RTW row so bookings and invoices
-- do not lose bank transfer after the cutover.
INSERT INTO "BankAccount" (
  "id", "currency", "businessLine", "accountName", "accountNumber", "bankName",
  "swiftBic", "iban", "sortCode", "routingNumber", "intermediaryBank", "instructions",
  "feeBearer", "feeTolerance", "isActive", "createdAt", "updatedAt"
)
SELECT
  'ba_atelier_ngn',
  "currency",
  'ATELIER'::"BusinessLine",
  "accountName",
  "accountNumber",
  "bankName",
  "swiftBic",
  "iban",
  "sortCode",
  "routingNumber",
  "intermediaryBank",
  "instructions",
  "feeBearer",
  "feeTolerance",
  "isActive",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "BankAccount"
WHERE "currency" = 'NGN' AND "businessLine" = 'RTW'
ON CONFLICT ("currency", "businessLine") DO NOTHING;

INSERT INTO "BankAccount" (
  "id", "currency", "businessLine", "accountName", "accountNumber", "bankName",
  "swiftBic", "iban", "sortCode", "routingNumber", "intermediaryBank", "instructions",
  "feeBearer", "feeTolerance", "isActive", "createdAt", "updatedAt"
)
SELECT
  'ba_atelier_usd',
  "currency",
  'ATELIER'::"BusinessLine",
  "accountName",
  "accountNumber",
  "bankName",
  "swiftBic",
  "iban",
  "sortCode",
  "routingNumber",
  "intermediaryBank",
  "instructions",
  "feeBearer",
  "feeTolerance",
  "isActive",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "BankAccount"
WHERE "currency" = 'USD' AND "businessLine" = 'RTW'
ON CONFLICT ("currency", "businessLine") DO NOTHING;
