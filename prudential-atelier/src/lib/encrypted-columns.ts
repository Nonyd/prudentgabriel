import { CAPABILITY_COLUMNS } from "@/lib/capability-registry";

/**
 * Every column that holds ciphertext from src/lib/encryption.ts. Key rotation
 * (scripts/reencrypt-secrets.ts) rewrites exactly these; a column missing from
 * here would become unreadable when the old key is retired.
 * scripts/test-secrets-at-rest.ts checks the list against the code that encrypts.
 */
export type EncryptedColumn = {
  model: string;
  column: string;
  /** Only rows whose value looks encrypted (a column that also holds plain values). */
  prefixOnly?: boolean;
  holds: string;
};

export const ENCRYPTED_COLUMNS: readonly EncryptedColumn[] = [
  {
    model: "SiteSetting",
    column: "value",
    prefixOnly: true,
    holds: "PASSWORD-type settings: payment gateway secret keys, SMTP and API credentials",
  },
  {
    model: "SavedPaymentMethod",
    column: "paystackAuthCodeEnc",
    holds: "Paystack authorisation codes: a reusable authority to charge a saved card",
  },
  ...CAPABILITY_COLUMNS.filter((c) => c.enc).map((c) => ({
    model: c.model,
    column: c.enc!,
    holds: `the raw link token for ${c.model}.${c.column}, so the same link can be sent again`,
  })),
];
