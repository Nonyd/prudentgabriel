import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consultationEnquirySchema } from "@/validations/consultation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { AUTH_WINDOW_MS, accountKey } from "@/lib/auth-limits";
import { getWatYmd } from "@/lib/consultation";
import { daysUntil, isShortNotice } from "@/lib/consultation-enquiry-shared";
import { generateEnquiryNumber, getShortNoticeDays } from "@/lib/consultation-enquiry";
import { notifyConsultationEnquiry } from "@/lib/notifications";
import { sendAdminNotificationEmail } from "@/lib/email";
import { sendUsingCatalog } from "@/lib/catalog-email";
import { EMAIL_TEMPLATE_KEYS } from "@/lib/admin-email-catalog";
import { getPublicAppUrl } from "@/lib/app-url";
import { logServerError } from "@/lib/logger";
import { rejectIfAtelierClosed } from "@/lib/atelier-bookings";

/** Per address (shared Wi-Fi, carrier NAT) and per inbox, like the BA1 limits. */
const ADDRESS_LIMIT = 20;
const INBOX_LIMIT = 3;

function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many enquiries. Please wait a little and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * BA2: the atelier application, open while atelier_bookings_enabled is on (403
 * when the house has closed). A close event date is flagged for a call, never
 * refused; only a date already past is rejected (400).
 */
export async function POST(req: NextRequest) {
  const closed = await rejectIfAtelierClosed();
  if (closed) return closed;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = consultationEnquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const email = data.clientEmail.toLowerCase();

  const today = getWatYmd();
  if (daysUntil(data.eventDate, today) < 0) {
    return NextResponse.json({ error: "The event date has already passed." }, { status: 400 });
  }

  const ip = getClientIp(req);
  const address = await checkRateLimit(`enquiry-address:${ip}`, ADDRESS_LIMIT, AUTH_WINDOW_MS);
  if (!address.ok) return tooMany(address.retryAfterSec);
  const inbox = await checkRateLimit(`enquiry-inbox:${accountKey(email)}`, INBOX_LIMIT, AUTH_WINDOW_MS);
  if (!inbox.ok) return tooMany(inbox.retryAfterSec);

  const shortNotice = isShortNotice(data.eventDate, today, await getShortNoticeDays());

  let enquiry;
  for (let attempt = 0; ; attempt++) {
    try {
      enquiry = await prisma.consultationEnquiry.create({
        data: {
          enquiryNumber: generateEnquiryNumber(),
          clientName: data.clientName,
          clientEmail: email,
          clientPhone: data.clientPhone,
          eventDate: new Date(`${data.eventDate}T00:00:00.000Z`),
          eventType: data.eventType,
          wearer: data.wearer,
          outfitType: data.outfitType,
          notes: data.notes || null,
          moodboardImages: data.moodboardImages,
          shortNotice,
        },
      });
      break;
    } catch (e) {
      // enquiryNumber is random: retry a collision, rethrow anything else.
      const code = (e as { code?: string }).code;
      if (code !== "P2002" || attempt >= 4) throw e;
    }
  }

  const eventOn = enquiry.eventDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  try {
    await notifyConsultationEnquiry(enquiry, "new");
    await sendAdminNotificationEmail(
      `${shortNotice ? "Short-notice enquiry" : "New consultation enquiry"} — ${enquiry.enquiryNumber}`,
      `<p><strong>${escapeHtml(enquiry.clientName)}</strong> · ${escapeHtml(enquiry.clientPhone)} · ${escapeHtml(email)}</p>
       <p>${escapeHtml(enquiry.eventType)} on ${eventOn}. ${escapeHtml(enquiry.outfitType)}.</p>
       ${shortNotice ? "<p><strong>Short notice: call her about an express commission.</strong></p>" : ""}
       <p><a href="${getPublicAppUrl()}/admin/consultations/enquiries?open=${enquiry.id}">Open the enquiry queue</a></p>`,
      `consultation-enquiry-admin:${enquiry.id}`,
    );
    await sendUsingCatalog({
      key: EMAIL_TEMPLATE_KEYS.CONSULTATION_ENQUIRY_RECEIVED,
      to: email,
      vars: {
        firstName: enquiry.clientName.split(/\s+/)[0] ?? enquiry.clientName,
        enquiryRef: enquiry.enquiryNumber,
        eventType: enquiry.eventType.toLowerCase(),
        eventDate: eventOn,
      },
      outboxTemplate: "consultation-enquiry-received",
      idempotencyKey: `consultation-enquiry-received:${enquiry.id}`,
      relatedType: "ConsultationEnquiry",
      relatedId: enquiry.id,
    });
  } catch (e) {
    // The enquiry is saved; a notification failure must not lose it.
    await logServerError({ errorType: "CONSULTATION_ENQUIRY_NOTIFY", error: e });
  }

  return NextResponse.json(
    { enquiryNumber: enquiry.enquiryNumber, shortNotice },
    { status: 201 },
  );
}
