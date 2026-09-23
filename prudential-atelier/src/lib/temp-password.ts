import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

/**
 * Token sweep: accounts the house opens (a staff invitation, a paid order) no
 * longer get a temporary password in an email. The old ones were WORD-NNNN from
 * Math.random, about 90,000 possibilities, and sat in the outbox as plain text.
 * The account starts with a password nobody knows; the email carries a
 * set-your-password link (a hashed, expiring PasswordResetToken).
 */
export async function unusablePasswordHash(): Promise<string> {
  return bcrypt.hash(randomBytes(32).toString("base64url"), 12);
}
