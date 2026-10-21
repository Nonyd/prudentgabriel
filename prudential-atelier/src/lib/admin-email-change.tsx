import { Heading, Text } from "@react-email/components";
import { EmailStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isProtectedAccount } from "@/lib/roles";
import { forceSignOutUser } from "@/lib/password-reset";
import { logActivity, logServerError } from "@/lib/logger";
import { renderBrandedEmail, sendEmail } from "@/lib/email";
import EmailLayout from "@/emails/components/EmailLayout";
import { EMAIL_CHOC, EMAIL_INK, FONT_BODY } from "@/emails/components/email-tokens";

/**
 * Changing someone's login email hands over their account, so it is Super Admin
 * work only (decided 16 October 2026), for clients, staff and admins alike. One
 * rule for every screen: the address must be free, the new one is unconfirmed
 * until its owner confirms it, she is signed out everywhere, the change is
 * logged, and the OLD address is told, so a hijack never goes unnoticed.
 */

export type EmailChangeActor = { id: string; email: string | null | undefined; role: string | null | undefined };

/**
 * Records that keep their own copy of her email. Mail about them goes to that
 * copy (a shop order mails `guestEmail ?? user.email`, a commission its
 * `clientEmail`), so every one follows her to the new address: past and present,
 * and so everything sent from now on. Left as they were: her marketing
 * preferences and newsletter sign-up (consent belongs to the address), saved
 * Paystack cards (the payment provider's record), and logs and messages (history).
 */
export const EMAIL_COPY_RECORDS = [
  "commissions",
  "quotations",
  "invoices",
  "shopOrders",
  "consultations",
  "enquiries",
  "bespokeRequests",
  "checkouts",
  "couponUses",
  "loyaltyNotices",
  "queuedEmails",
] as const;
export type EmailChangeRecords = Record<(typeof EMAIL_COPY_RECORDS)[number], number>;

export type EmailChangeResult =
  | { ok: true; changed: boolean; oldEmail: string; newEmail: string; records?: EmailChangeRecords }
  | { ok: false; status: number; error: string };

const emailSchema = z.string().trim().toLowerCase().email().max(254);

function EmailChangedNotice({ newEmail }: { newEmail: string }) {
  return (
    <EmailLayout family="transactional" previewText="The email on your account was changed">
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: EMAIL_CHOC, margin: "0 0 12px" }}>
        Your sign-in email was changed
      </Heading>
      <Text style={{ fontSize: 15, color: EMAIL_INK, fontFamily: FONT_BODY }}>
        The Prudent Gabriel team changed the email you sign in with to {newEmail}. From now on, sign in and receive
        account emails at that address.
      </Text>
      <Text style={{ fontSize: 15, color: EMAIL_INK, fontFamily: FONT_BODY }}>
        If you did not ask for this, reply to this email or write to hello@prudentgabriel.com straight away.
      </Text>
    </EmailLayout>
  );
}

export async function changeUserEmail(params: {
  targetUserId: string;
  nextEmail: unknown;
  actor: EmailChangeActor;
  ip?: string;
  /** Her own address, after she re-entered her password (Account settings). */
  selfConfirmed?: boolean;
}): Promise<EmailChangeResult> {
  if (params.actor.role !== "SUPER_ADMIN") {
    return { ok: false, status: 403, error: "Only a Super Admin can change a sign-in email." };
  }
  const parsed = emailSchema.safeParse(params.nextEmail);
  if (!parsed.success) return { ok: false, status: 400, error: "Please enter a valid email address." };
  const newEmail = parsed.data;

  const target = await prisma.user.findUnique({
    where: { id: params.targetUserId },
    select: { id: true, email: true, name: true },
  });
  if (!target) return { ok: false, status: 404, error: "Account not found." };
  const oldEmail = target.email.trim().toLowerCase();
  if (newEmail === oldEmail) return { ok: true, changed: false, oldEmail, newEmail };

  const self = target.id === params.actor.id;
  if (self && !params.selfConfirmed) {
    return { ok: false, status: 400, error: "Change your own email from Account settings, with your password." };
  }
  // The owner accounts are named in the server's configuration. Nobody else may
  // change them; the owner may change her own, with her password.
  if (isProtectedAccount(target.email) && !(self && params.selfConfirmed)) {
    return { ok: false, status: 403, error: "This owner account's email is set in the server configuration." };
  }
  if (isProtectedAccount(newEmail)) return { ok: false, status: 400, error: "That email is reserved." };
  if (oldEmail.startsWith("deleted_") && oldEmail.endsWith("@prudentgabriel.local")) {
    return { ok: false, status: 400, error: "This account was deleted by its owner." };
  }

  const taken = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
  if (taken && taken.id !== target.id) {
    return { ok: false, status: 409, error: "Another account already uses that email." };
  }

  let records: EmailChangeRecords;
  try {
    records = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        // A new address is unproven until its owner confirms it.
        data: { email: newEmail, emailVerified: null },
      });
      const is = { equals: oldEmail, mode: "insensitive" as const };
      const to = newEmail;
      // In EMAIL_COPY_RECORDS order.
      const counts = [
        await tx.bespokeOrder.updateMany({ where: { clientEmail: is }, data: { clientEmail: to } }),
        await tx.quotation.updateMany({ where: { clientEmail: is }, data: { clientEmail: to } }),
        await tx.invoice.updateMany({ where: { clientEmail: is }, data: { clientEmail: to } }),
        await tx.order.updateMany({ where: { guestEmail: is }, data: { guestEmail: to } }),
        await tx.consultationBooking.updateMany({ where: { clientEmail: is }, data: { clientEmail: to } }),
        await tx.consultationEnquiry.updateMany({ where: { clientEmail: is }, data: { clientEmail: to } }),
        await tx.bespokeRequest.updateMany({ where: { email: is }, data: { email: to } }),
        await tx.checkoutSession.updateMany({ where: { email: is }, data: { email: to } }),
        await tx.couponUsage.updateMany({ where: { email: is }, data: { email: to } }),
        await tx.loyaltyCorrectionNotice.updateMany({ where: { email: is }, data: { email: to } }),
        // Order and account mail queued or waiting to retry goes to her new address; marketing (priority 0) does not.
        await tx.emailMessage.updateMany({
          where: { to: is, status: { in: [EmailStatus.QUEUED, EmailStatus.FAILED] }, priority: { gt: 0 } },
          data: { to },
        }),
      ];
      return Object.fromEntries(EMAIL_COPY_RECORDS.map((k, i) => [k, counts[i].count])) as EmailChangeRecords;
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return { ok: false, status: 409, error: "Another account already uses that email." };
    }
    throw e;
  }

  // Someone else's change signs her out everywhere. Her own change (password just
  // confirmed) keeps her signed in on this device.
  if (!self) await forceSignOutUser(target.id);

  await logActivity({
    userId: params.actor.id,
    userEmail: params.actor.email ?? undefined,
    userRole: params.actor.role ?? undefined,
    action: "UPDATE",
    module: "users",
    description:
      `${self ? "Changed own sign-in email" : "Changed sign-in email"} ${oldEmail} → ${newEmail}` +
      (Object.values(records).some(Boolean)
        ? `; moved onto ${Object.entries(records)
            .filter(([, n]) => n)
            .map(([k, n]) => `${n} ${k}`)
            .join(", ")}`
        : ""),
    recordId: target.id,
    recordType: "User",
    ipAddress: params.ip,
  }).catch(() => {});

  // Tell the old address; a failure here never undoes the change.
  void (async () => {
    const html = await renderBrandedEmail(<EmailChangedNotice newEmail={newEmail} />);
    await sendEmail({
      to: oldEmail,
      subject: "Your Prudent Gabriel sign-in email was changed",
      html,
      template: "account-email-changed",
      idempotencyKey: `account-email-changed:${target.id}:${newEmail}`,
    });
  })().catch((error) => logServerError({ errorType: "EMAIL_CHANGE_NOTICE", error }));

  return { ok: true, changed: true, oldEmail, newEmail, records };
}
