import { NextRequest, NextResponse } from "next/server";
import { ConsultationEnquiryStatus } from "@prisma/client";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { RESUMABLE_BOOKING_WHERE, bookingLinkPath, issueBookingLink } from "@/lib/consultation-enquiry";
import { sendUsingCatalog } from "@/lib/catalog-email";
import { EMAIL_TEMPLATE_KEYS } from "@/lib/admin-email-catalog";
import { getPublicAppUrl } from "@/lib/app-url";
import { logActivity } from "@/lib/logger";
import { getClientIp } from "@/lib/rate-limit";
import { deleteFilesOfDeletedRows } from "@/lib/cron/jobs/data-retention";

const bodySchema = z.discriminatedUnion("action", [
  /** The approval note is optional; a decline still records why. */
  z.object({
    action: z.literal("approve"),
    reason: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((r) => r || null),
  }),
  z.object({
    action: z.literal("decline"),
    reason: z.string().trim().min(3).max(1000),
    /** Send the courteous decline email. The reason is internal and never sent. */
    notifyClient: z.boolean().default(true),
  }),
  /** A fresh link for an approved enquiry whose link expired or went astray. */
  z.object({ action: z.literal("resend") }),
]);

function firstName(name: string) {
  return name.split(/\s+/)[0] ?? name;
}

/**
 * BA2: approve or decline, each with a recorded reason. Approval issues the
 * booking link (AZ3: random, hashed, expiring) and emails it. Decisions are
 * made once: a decided enquiry cannot be re-decided (409).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("consultations");
  if (!gate.ok) return gate.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const enquiry = await prisma.consultationEnquiry.findUnique({ where: { id } });
  if (!enquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = gate.session.user;
  const decidedBy = user.name?.trim() || user.email || user.id;
  const now = new Date();

  if (input.action === "resend") {
    // Booked but never paid (payment abandoned halfway) counts as unbooked here.
    const unpaidBooking =
      enquiry.status === ConsultationEnquiryStatus.BOOKED && enquiry.bookingId
        ? (await prisma.consultationBooking.count({ where: { id: enquiry.bookingId, ...RESUMABLE_BOOKING_WHERE } })) === 1
        : false;
    if (enquiry.status !== ConsultationEnquiryStatus.APPROVED && !unpaidBooking) {
      return NextResponse.json({ error: "Only an approved, unbooked enquiry has a booking link." }, { status: 409 });
    }
  } else {
    // Decide once, atomically: two people clicking at once cannot both win.
    const next =
      input.action === "approve" ? ConsultationEnquiryStatus.APPROVED : ConsultationEnquiryStatus.DECLINED;
    const decided = await prisma.consultationEnquiry.updateMany({
      where: { id, status: ConsultationEnquiryStatus.PENDING },
      data: { status: next, decisionReason: input.reason, decidedAt: now, decidedBy },
    });
    if (decided.count !== 1) {
      return NextResponse.json({ error: "This enquiry has already been decided." }, { status: 409 });
    }
  }

  let expiresAt: Date | null = null;
  if (input.action === "approve" || input.action === "resend") {
    const link = issueBookingLink(now);
    await prisma.consultationEnquiry.update({ where: { id }, data: link.data });
    expiresAt = link.data.publicTokenExpiresAt;
    await sendUsingCatalog({
      key: EMAIL_TEMPLATE_KEYS.CONSULTATION_ENQUIRY_APPROVED,
      to: enquiry.clientEmail,
      vars: {
        firstName: firstName(enquiry.clientName),
        enquiryRef: enquiry.enquiryNumber,
        link: `${getPublicAppUrl()}${bookingLinkPath(link.raw)}`,
        expiresOn: expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      },
      outboxTemplate: "consultation-enquiry-approved",
      // One email per issued link: a resend is a new link, so a new key.
      idempotencyKey: `consultation-enquiry-approved:${id}:${link.data.publicToken.slice(0, 16)}`,
      relatedType: "ConsultationEnquiry",
      relatedId: id,
    });
  } else if (input.notifyClient) {
    await sendUsingCatalog({
      key: EMAIL_TEMPLATE_KEYS.CONSULTATION_ENQUIRY_DECLINED,
      to: enquiry.clientEmail,
      vars: {
        firstName: firstName(enquiry.clientName),
        enquiryRef: enquiry.enquiryNumber,
        shopLink: `${getPublicAppUrl()}/shop`,
      },
      outboxTemplate: "consultation-enquiry-declined",
      idempotencyKey: `consultation-enquiry-declined:${id}`,
      relatedType: "ConsultationEnquiry",
      relatedId: id,
    });
  }

  void logActivity({
    userId: user.id,
    userEmail: user.email ?? undefined,
    userRole: user.role,
    action: "UPDATE",
    module: "consultations",
    description:
      input.action === "resend"
        ? `Re-sent booking link for enquiry ${enquiry.enquiryNumber}`
        : `${input.action === "approve" ? "Approved" : "Declined"} enquiry ${enquiry.enquiryNumber}${input.reason ? `: ${input.reason}` : ""}`,
    recordId: id,
    recordType: "ConsultationEnquiry",
  }).catch(() => {});

  const updated = await prisma.consultationEnquiry.findUnique({
    where: { id },
    select: { id: true, status: true, decisionReason: true, decidedAt: true, decidedBy: true, publicTokenExpiresAt: true },
  });
  return NextResponse.json({ enquiry: updated, linkExpiresAt: expiresAt });
}

const deleteSchema = z.object({
  /** Optional note kept in the activity log with who deleted it. */
  reason: z.string().trim().max(500).optional(),
});

/**
 * Delete an enquiry (spam, duplicates, a client's request). Who deleted it is
 * kept in the activity log with the enquiry number and status, not the
 * client's details. An enquiry that became a booking is part of that client's
 * record and is refused (409).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi("consultations");
  if (!gate.ok) return gate.response;
  const { id } = await params;

  let reason: string | undefined;
  try {
    const parsed = deleteSchema.safeParse(await req.json());
    if (parsed.success) reason = parsed.data.reason || undefined;
  } catch {
    reason = undefined;
  }

  const enquiry = await prisma.consultationEnquiry.findUnique({
    where: { id },
    select: { id: true, enquiryNumber: true, status: true, eventType: true, bookingId: true, moodboardImages: true },
  });
  if (!enquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (enquiry.bookingId || enquiry.status === ConsultationEnquiryStatus.BOOKED) {
    return NextResponse.json(
      { error: "This enquiry became a booking, so it stays with that client's record. Cancel the booking instead." },
      { status: 409 },
    );
  }

  await prisma.consultationEnquiry.delete({ where: { id } });

  // Her inspiration pictures go too, unless the same file is still used elsewhere.
  if (enquiry.moodboardImages.length) {
    void deleteFilesOfDeletedRows(enquiry.moodboardImages).catch(() => {});
  }

  const user = gate.session.user;
  await logActivity({
    userId: user.id,
    userEmail: user.email ?? undefined,
    userRole: user.role,
    action: "DELETE",
    module: "consultations",
    description: `Deleted enquiry ${enquiry.enquiryNumber} (${enquiry.status.toLowerCase()}, ${enquiry.eventType})${reason ? `: ${reason}` : ""}`,
    recordId: id,
    recordType: "ConsultationEnquiry",
    ipAddress: getClientIp(req),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
