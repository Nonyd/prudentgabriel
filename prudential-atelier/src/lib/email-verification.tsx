import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { renderBrandedEmail, sendEmail } from "@/lib/email";
import VerifyEmailEmail from "@/emails/VerifyEmailEmail";

/**
 * Email verification.
 *
 * Several things are handed to an account because its email matches a record
 * made before the account existed: guest chats, guest orders, consultations,
 * commissions staff opened for her. That is only safe once she has shown she
 * owns the inbox, so those checks go through `provenEmail`, never the raw
 * session email. Accounts that existed before verification shipped were marked
 * verified by migration 20261018_email_verified_backfill.
 */

export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const IDENTIFIER_PREFIX = "verify-email:";

function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function identifierFor(userId: string, email: string): string {
  return `${IDENTIFIER_PREFIX}${userId}:${email.trim().toLowerCase()}`;
}

export function verifyEmailUrl(raw: string): string {
  return `${getPublicAppUrl()}/auth/verify-email/${raw}`;
}

/**
 * The email this account has proven it owns, lower-cased, or null. Use it for
 * every "her email matches the record" check; a userId match needs nothing.
 */
export async function provenEmail(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });
  if (!user?.email || !user.emailVerified) return null;
  return user.email.trim().toLowerCase();
}

export async function isEmailVerified(userId: string): Promise<boolean> {
  return (await provenEmail(userId)) !== null;
}

/** A fresh single-use link; any earlier link for this account stops working. */
export async function issueVerifyEmailToken(userId: string, email: string): Promise<string> {
  await prisma.verificationToken.deleteMany({ where: { identifier: { startsWith: `${IDENTIFIER_PREFIX}${userId}:` } } });
  const raw = randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      identifier: identifierFor(userId, email),
      token: hashToken(raw),
      expires: new Date(Date.now() + VERIFY_TTL_MS),
    },
  });
  return raw;
}

export async function sendVerifyEmail(params: { userId: string; email: string; firstName: string }): Promise<void> {
  const raw = await issueVerifyEmailToken(params.userId, params.email);
  const html = await renderBrandedEmail(
    <VerifyEmailEmail firstName={params.firstName || "there"} verifyUrl={verifyEmailUrl(raw)} />,
  );
  await sendEmail({
    to: params.email,
    subject: "Confirm your email · Prudent Gabriel",
    html,
    template: "verify-email",
    // A new key per link, so a resend is never swallowed as a duplicate.
    idempotencyKey: `verify-email:${params.userId}:${hashToken(raw).slice(0, 16)}`,
  });
}

export type VerifyResult = "verified" | "already" | "invalid" | "expired";

/**
 * Spend a link. It verifies the address it was sent to only while that is still
 * the account's email, so a link issued before an email change verifies nothing.
 */
export async function consumeVerifyEmailToken(raw: string): Promise<VerifyResult> {
  if (!/^[a-f0-9]{64}$/.test(raw)) return "invalid";
  const hash = hashToken(raw);
  const row = await prisma.verificationToken.findUnique({ where: { token: hash } });
  if (!row || !row.identifier.startsWith(IDENTIFIER_PREFIX)) return "invalid";
  // Single use: whoever deletes the row owns this click.
  const { count } = await prisma.verificationToken.deleteMany({ where: { token: hash } });
  if (count === 0) return "invalid";
  if (row.expires.getTime() < Date.now()) return "expired";

  const rest = row.identifier.slice(IDENTIFIER_PREFIX.length);
  const sep = rest.indexOf(":");
  const userId = rest.slice(0, sep);
  const email = rest.slice(sep + 1);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } });
  if (!user || user.email.trim().toLowerCase() !== email) return "invalid";
  if (user.emailVerified) return "already";
  await prisma.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
  return "verified";
}

/** Google (or another provider that vouches for the address) counts as proof. */
export async function markEmailVerified(userId: string): Promise<void> {
  await prisma.user.updateMany({ where: { id: userId, emailVerified: null }, data: { emailVerified: new Date() } });
}
