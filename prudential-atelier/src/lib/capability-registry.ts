/**
 * Every column whose value, put in a URL or an email, opens something without
 * a sign-in. The rule (third time is a rule, not a fix):
 *
 *   1. The raw value is 32 random bytes (generateCapabilityToken), never a cuid,
 *      nanoid, counter or reference number.
 *   2. The column stores only its SHA-256. The raw value lives in the link and,
 *      when the house must send the same link again, AES-GCM in `enc`.
 *   3. The column's database default is a random hash that opens nothing.
 *   4. It expires (`expires`), unless there is a written reason it cannot.
 *   5. Unknown and expired answer alike: a 404 (or 410 where AZ3 already said so).
 *
 * A new column like this goes on this list, or scripts/test-token-defaults.ts fails.
 * scripts/upgrade-capability-tokens.ts reads the list to hash anything still plaintext.
 */
export type CapabilityColumn = {
  /** Prisma model (also the table name). */
  model: string;
  column: string;
  /** AES-GCM copy of the raw value, for re-sending the same link. Null: never re-sent. */
  enc: string | null;
  /** Null only with `noExpiryReason`. */
  expires: string | null;
  noExpiryReason?: string;
  opens: string;
};

export const CAPABILITY_COLUMNS: readonly CapabilityColumn[] = [
  { model: "Invoice", column: "publicToken", enc: "publicTokenEnc", expires: "publicTokenExpiresAt", opens: "an invoice, and paying it" },
  { model: "BespokeOrder", column: "trackingToken", enc: "trackingTokenEnc", expires: "trackingTokenExpiresAt", opens: "a commission's progress" },
  { model: "BespokeOrder", column: "receiptConfirmToken", enc: "receiptConfirmTokenEnc", expires: "receiptConfirmTokenExpiresAt", opens: "confirming receipt, asking for alterations" },
  { model: "StageApproval", column: "publicToken", enc: "publicTokenEnc", expires: "publicTokenExpiresAt", opens: "approving a design stage" },
  { model: "Quotation", column: "approvalToken", enc: "approvalTokenEnc", expires: "approvalTokenExpiresAt", opens: "accepting a quotation" },
  { model: "ConsultationEnquiry", column: "publicToken", enc: "publicTokenEnc", expires: "publicTokenExpiresAt", opens: "booking an approved consultation" },
  {
    model: "ChatConversation",
    column: "publicToken",
    enc: null,
    expires: "publicTokenExpiresAt",
    opens: "a chat conversation, from the visitor's own browser",
  },
  { model: "TeamInvitation", column: "token", enc: null, expires: "expiresAt", opens: "creating an admin account" },
  { model: "CheckoutSession", column: "restoreToken", enc: "restoreTokenEnc", expires: "restoreTokenExpiresAt", opens: "refilling a bag from a reminder" },
  {
    model: "EmailPreference",
    column: "unsubscribeToken",
    enc: "unsubscribeTokenEnc",
    expires: null,
    noExpiryReason: "An unsubscribe link must keep working for as long as the email exists; the worst it can do is stop marketing mail.",
    opens: "unsubscribing an address from marketing mail",
  },
  {
    model: "PasswordResetToken",
    column: "token",
    enc: null,
    expires: "expiresAt",
    opens: "setting an account's password (forgot password, welcome and staff invitation emails)",
  },
];

/**
 * Token-named columns that are not capabilities, and why. The schema test fails
 * on any token-named column in neither list.
 */
export const NOT_CAPABILITY_COLUMNS: Record<string, string> = {
  "Session.sessionToken": "Auth.js database sessions; this app signs in with JWTs and only ever deletes these rows.",
  "VerificationToken.token": "Auth.js email sign-in, which this app does not offer; the table stays empty.",
  "Account.refresh_token": "Google's OAuth token, held by the Auth.js adapter; never put in a URL or an email.",
  "Account.access_token": "Google's OAuth token, held by the Auth.js adapter; never put in a URL or an email.",
  "Account.id_token": "Google's OAuth token, held by the Auth.js adapter; never put in a URL or an email.",
  "Account.token_type": "A label (\"bearer\"), not a secret.",
};
