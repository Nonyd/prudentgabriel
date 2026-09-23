import { NextRequest, NextResponse } from "next/server";
import { ConsultationEnquiryStatus, ConsultationStatus, PaymentGateway, PaymentStatus, Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generatePaymentReference } from "@/lib/payments/index";
import { getSupportedGateways } from "@/lib/payments/config";
import { addDaysToWatYmd, dateToWatYmd, generateBookingNumber, getWatYmd, ymdCompare } from "@/lib/consultation";
import { consultationBookingSchema } from "@/validations/consultation";
import { notifyNewConsultation } from "@/lib/notifications";
import { getCMSContent } from "@/lib/cms";
import { getPageFieldKeys } from "@/lib/cms-config";
import { sanitizeAttribution } from "@/lib/analytics/attribution";
import { getOfferingTypeConfig, isOfferingTypeVirtual, type OfferingTypeKey } from "@/lib/consultation-types";
import { findBookableEnquiry } from "@/lib/consultation-enquiry";
import { INVITATION_ONLY_MESSAGE, consultationTermsText, wearerLabel } from "@/lib/consultation-enquiry-shared";
import { createLegalTermsSnapshot } from "@/lib/legal-tokens";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { asChargeCurrency, getConsultationFeeNGN, lockConsultationCharge } from "@/lib/consultation-fees";

/** Proposed dates are at least this many days out (WAT): the house needs time to fit Mrs. Prudent's diary. */
const MIN_LEAD_DAYS = 3;

/**
 * BA2: a booking is made only through an approved enquiry's link.
 *
 * - No token → 403. A token that is not an approved, unexpired, unbooked
 *   enquiry → 404 (the same for unknown, pending, declined, expired, used).
 * - Every type proposes three dates; the admin confirms one (the manual flow
 *   that Mrs. Prudent's sessions already used). Payment is unchanged.
 * - The non-refundable wording she saw, with the fee in it, is snapshotted on
 *   the booking with the legal terms version, like an order's shipping consent.
 *
 * The atelier_bookings_enabled switch no longer gates this: an invitation is
 * the house's own decision. Without a token nothing can be booked.
 */
export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, "consultation-create", 20, 15 * 60 * 1000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = (body as { enquiryToken?: unknown } | null)?.enquiryToken;
  if (typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ error: INVITATION_ONLY_MESSAGE }, { status: 403 });
  }
  const enquiry = await findBookableEnquiry(token);
  if (!enquiry) {
    return NextResponse.json({ error: "This booking link has expired or is no longer valid." }, { status: 404 });
  }

  const parsed = consultationBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const session = await auth();

  const offering = await prisma.consultantOffering.findFirst({
    where: {
      id: data.offeringId,
      consultantId: data.consultantId,
      isActive: true,
      consultant: { isActive: true },
    },
    include: { consultant: true },
  });
  if (!offering) {
    return NextResponse.json({ error: "Invalid offering" }, { status: 400 });
  }

  const typeKey = data.offeringType as OfferingTypeKey;
  const cms = await getCMSContent(getPageFieldKeys("consultation"));
  const typeConfig = getOfferingTypeConfig(typeKey, cms);
  if (!typeConfig.enabled) {
    return NextResponse.json({ error: "This consultation type is not available" }, { status: 400 });
  }
  if (isOfferingTypeVirtual(typeKey) && !data.virtualPlatform) {
    return NextResponse.json({ error: "Virtual platform required" }, { status: 400 });
  }

  const minYmd = addDaysToWatYmd(getWatYmd(), MIN_LEAD_DAYS);
  const proposed = [data.preferredDate1, data.preferredDate2, data.preferredDate3].map(dateToWatYmd);
  if (proposed.some((d) => ymdCompare(d, minYmd) < 0)) {
    return NextResponse.json(
      { error: `Proposed dates must be at least ${MIN_LEAD_DAYS} days from today` },
      { status: 400 },
    );
  }
  if (new Set(proposed).size !== 3) {
    return NextResponse.json({ error: "Please propose three different dates" }, { status: 400 });
  }

  // BA3: the fee is a setting, frozen here; USD/GBP also lock the rate and the exact amount.
  const feeNGN = await getConsultationFeeNGN(typeKey);
  const termsText = consultationTermsText(feeNGN);
  if (data.termsText.trim() !== termsText) {
    // The fee changed after the page loaded: she must see and accept the new wording.
    return NextResponse.json(
      { error: "The consultation terms have changed. Please review them again.", termsText },
      { status: 409 },
    );
  }

  const offered = await getSupportedGateways(data.currency, "ATELIER");
  if (!offered.includes(data.gateway)) {
    return NextResponse.json({ error: "That payment method is not available for this currency" }, { status: 400 });
  }
  const paymentGateway = data.gateway as PaymentGateway;
  const paymentRef =
    data.gateway === "BANK_TRANSFER"
      ? data.paymentRef && /^PA-CONSULT-/i.test(data.paymentRef)
        ? data.paymentRef
        : generatePaymentReference("CONSULT")
      : undefined;

  // Shown one number, charged another — never. The amount she saw must be the amount locked.
  const charge = await lockConsultationCharge(feeNGN, asChargeCurrency(data.currency));
  if (Math.abs(charge.amount - data.quotedAmount) > 0.005) {
    return NextResponse.json(
      { error: "The price in your currency has changed. Please review it again.", amount: charge.amount },
      { status: 409 },
    );
  }

  const legalTerms = await createLegalTermsSnapshot();
  const now = new Date();
  const description = [
    `Enquiry ${enquiry.enquiryNumber}: ${wearerLabel(enquiry.wearer)}; ${enquiry.outfitType}.`,
    enquiry.notes?.trim() || "",
    data.description?.trim() || "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const referenceImages = Array.from(new Set([...enquiry.moodboardImages, ...data.referenceImages])).slice(0, 10);

  let booking;
  try {
    booking = await prisma.$transaction(async (tx) => {
      const created = await tx.consultationBooking.create({
        data: {
          bookingNumber: generateBookingNumber(),
          offeringId: offering.id,
          consultantId: offering.consultantId,
          userId: session?.user?.id ?? null,
          clientName: enquiry.clientName,
          clientEmail: enquiry.clientEmail,
          clientPhone: data.clientPhone?.trim() || enquiry.clientPhone,
          clientCountry: data.clientCountry,
          clientInstagram: data.clientInstagram?.trim() || null,
          occasion: enquiry.eventType,
          description,
          referenceImages,
          preferredDate1: data.preferredDate1,
          preferredDate2: data.preferredDate2,
          preferredDate3: data.preferredDate3,
          confirmedDate: null,
          confirmedTime: null,
          offeringType: data.offeringType,
          virtualPlatform: data.virtualPlatform ?? null,
          meetingPlatform: data.virtualPlatform
            ? data.virtualPlatform.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            : null,
          // Frozen here: payment, invoices and reports read this, never the live price.
          feeNGN,
          ...charge.data,
          currency: data.currency,
          paymentGateway,
          paymentRef: paymentRef ?? null,
          paymentStatus: PaymentStatus.PENDING,
          status: ConsultationStatus.PENDING_PAYMENT,
          attribution: sanitizeAttribution(data.attribution) ?? undefined,
          termsAcknowledgedAt: now,
          termsText,
          legalTermsVersion: legalTerms.version,
          legalTermsSnapshot: legalTerms as unknown as Prisma.InputJsonValue,
        },
      });
      // One booking per invitation, even if the link is submitted twice at once.
      const claimed = await tx.consultationEnquiry.updateMany({
        where: { id: enquiry.id, status: ConsultationEnquiryStatus.APPROVED, bookingId: null },
        data: { status: ConsultationEnquiryStatus.BOOKED, bookingId: created.id },
      });
      if (claimed.count !== 1) throw new Error("ENQUIRY_ALREADY_BOOKED");
      return created;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ENQUIRY_ALREADY_BOOKED") {
      return NextResponse.json({ error: "This booking link has already been used." }, { status: 409 });
    }
    throw e;
  }

  void notifyNewConsultation(booking);

  return NextResponse.json({
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    feeNGN: booking.feeNGN,
    currency: booking.currency,
    paymentRef: booking.paymentRef,
  });
}
