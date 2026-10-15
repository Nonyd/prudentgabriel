import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { provenEmail } from "@/lib/email-verification";
import { checkRateLimit } from "@/lib/rate-limit";
import { getNotificationPrefs } from "@/lib/account-helpers";
import { logActivity, logServerError } from "@/lib/logger";
import { dataExportFilename } from "@/lib/marketing-consent-copy";

/**
 * Right of access / portability (NDPA 2023 s.34, GDPR Art. 15 and 20): her own
 * data as one JSON file. Records filed under an email are hers only once she has
 * proven that email (provenEmail); a userId match needs nothing. Left out on
 * purpose: staff and admin notes, other people's data, tokens, password hashes,
 * gateway payloads and card authorisation codes.
 */

const EXPORT_LIMIT = 5;
const EXPORT_WINDOW_MS = 60 * 60 * 1000;

function ci(email: string): Prisma.StringFilter {
  return { equals: email, mode: "insensitive" };
}

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  if (gate.session.user.viewAs) {
    return NextResponse.json(
      { error: "Not while viewing as a client: her data export is hers to request." },
      { status: 403 },
    );
  }

  const userId = gate.session.user.id!;
  const limited = await checkRateLimit(`account-export:${userId}`, EXPORT_LIMIT, EXPORT_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "You have downloaded your data several times this hour. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  try {
    const data = await buildExport(userId);
    if (!data) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    await logActivity({
      userId,
      // No EXPORT action in the enum: the export file is what was created.
      action: "CREATE",
      module: "account",
      description: "Data export downloaded by the account holder",
      recordId: userId,
      recordType: "User",
    });

    const now = new Date();
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${dataExportFilename(now)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    await logServerError({ errorType: "ACCOUNT_EXPORT", error, userId });
    return NextResponse.json({ error: "Could not prepare your data. Please try again." }, { status: 500 });
  }
}

async function buildExport(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      emailVerified: true,
      phone: true,
      image: true,
      birthdayDay: true,
      birthdayMonth: true,
      referralCode: true,
      pointsBalance: true,
      preferredGateway: true,
      createdAt: true,
      lastLogin: true,
      marketingConsentAt: true,
      marketingConsentSource: true,
      referredById: true,
    },
  });
  if (!user) return null;

  const email = await provenEmail(userId);
  const emailNorm = user.email.trim().toLowerCase();

  const profile = await prisma.clientProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      preferredSilhouettes: true,
      preferredColors: true,
      occasions: true,
      budgetRange: true,
      loyaltyPoints: true,
      loyaltyTier: true,
      totalSpend: true,
      createdAt: true,
      measurements: {
        select: {
          bust: true,
          waist: true,
          hips: true,
          shoulderWidth: true,
          sleeveLength: true,
          dressLength: true,
          thigh: true,
          inseam: true,
          neck: true,
          armhole: true,
          unit: true,
          notes: true,
          values: true,
          updatedAt: true,
        },
      },
      moodboards: { select: { title: true, images: true, notes: true, createdAt: true } },
      eventDates: { select: { label: true, date: true, createdAt: true } },
    },
  });

  const orders = await prisma.order.findMany({
    where: { OR: [{ userId }, ...(email ? [{ guestEmail: ci(email) }] : [])] },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      status: true,
      paymentStatus: true,
      currency: true,
      subtotal: true,
      shippingAmount: true,
      discount: true,
      pointsUsed: true,
      pointsDiscountNGN: true,
      total: true,
      amountPaid: true,
      balance: true,
      couponCode: true,
      guestName: true,
      guestEmail: true,
      guestPhone: true,
      addressSnapshot: true,
      shippingMethodKind: true,
      trackingNumber: true,
      carrier: true,
      collectedAt: true,
      isGift: true,
      giftMessage: true,
      notes: true,
      paidAt: true,
      shippingConsentAt: true,
      shippingConsentText: true,
      legalTermsVersion: true,
      items: {
        select: {
          quantity: true,
          size: true,
          color: true,
          price: true,
          lineTotal: true,
          sizeMode: true,
          measurements: true,
          typedUnit: true,
          optionLabel: true,
          product: { select: { name: true } },
        },
      },
    },
  });
  const orderIds = orders.map((o) => o.id);

  const bookings = await prisma.consultationBooking.findMany({
    where: { OR: [{ userId }, ...(email ? [{ clientEmail: ci(email) }] : [])] },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      bookingNumber: true,
      clientName: true,
      clientEmail: true,
      clientPhone: true,
      clientCountry: true,
      clientInstagram: true,
      occasion: true,
      description: true,
      referenceImages: true,
      preferredDate1: true,
      preferredDate2: true,
      preferredDate3: true,
      confirmedDate: true,
      confirmedTime: true,
      offeringType: true,
      meetingPlatform: true,
      moodboardImages: true,
      moodboardNotes: true,
      feeNGN: true,
      currency: true,
      paymentStatus: true,
      paidAt: true,
      status: true,
      cancellationReason: true,
      completedAt: true,
      termsAcknowledgedAt: true,
      termsText: true,
      createdAt: true,
    },
  });
  const bookingIds = bookings.map((b) => b.id);

  const enquiries = await prisma.consultationEnquiry.findMany({
    where: {
      OR: [
        ...(bookingIds.length ? [{ bookingId: { in: bookingIds } }] : []),
        ...(email ? [{ clientEmail: ci(email) }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      enquiryNumber: true,
      clientName: true,
      clientEmail: true,
      clientPhone: true,
      eventDate: true,
      eventType: true,
      occasionDetails: true,
      wearer: true,
      outfitType: true,
      notes: true,
      moodboardImages: true,
      dressCount: true,
      eventLocation: true,
      presentCity: true,
      presentState: true,
      presentCountry: true,
      fittingMode: true,
      fittingNote: true,
      deliveryDate: true,
      colourPalette: true,
      status: true,
      decidedAt: true,
      createdAt: true,
    },
  });

  const commissions = await prisma.bespokeOrder.findMany({
    where: {
      OR: [
        ...(profile ? [{ clientProfileId: profile.id }] : []),
        ...(email ? [{ clientEmail: ci(email) }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderRef: true,
      title: true,
      clientName: true,
      clientEmail: true,
      clientPhone: true,
      outfitDescription: true,
      occasionType: true,
      occasionDetails: true,
      outfitBrief: true,
      eventDate: true,
      eventLocation: true,
      clientLocation: true,
      deliveryDate: true,
      currentStage: true,
      status: true,
      currency: true,
      totalAmount: true,
      amountPaid: true,
      balance: true,
      measurementsSnapshot: true,
      measurementsTakenAt: true,
      moodboardImages: true,
      deliveredAt: true,
      receiptConfirmedAt: true,
      createdAt: true,
    },
  });
  const commissionIds = commissions.map((c) => c.id);

  const bespokeRequests = await prisma.bespokeRequest.findMany({
    where: { OR: [{ userId }, ...(email ? [{ email: ci(email) }] : [])] },
    orderBy: { createdAt: "desc" },
    select: {
      requestNumber: true,
      name: true,
      email: true,
      phone: true,
      country: true,
      occasion: true,
      description: true,
      budget: true,
      budgetRange: true,
      timeline: true,
      measurements: true,
      referenceImages: true,
      sketchUrls: true,
      preferredDate: true,
      status: true,
      createdAt: true,
    },
  });

  const ledgerIds = [userId, ...(email ? [`email:${email}`] : [])];
  const payments = await prisma.payment.findMany({
    where: {
      OR: [
        { clientId: { in: ledgerIds } },
        ...(orderIds.length ? [{ orderId: { in: orderIds } }] : []),
        ...(bookingIds.length ? [{ consultationId: { in: bookingIds } }] : []),
        ...(commissionIds.length ? [{ bespokeOrderId: { in: commissionIds } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      reference: true,
      amount: true,
      currency: true,
      method: true,
      status: true,
      purpose: true,
      createdAt: true,
      confirmedAt: true,
      order: { select: { orderNumber: true } },
      consultation: { select: { bookingNumber: true } },
      bespokeOrder: { select: { orderRef: true } },
      invoice: { select: { invoiceNumber: true } },
    },
  });

  const chatWhere: Prisma.ChatConversationWhereInput = {
    OR: [{ userId }, ...(email ? [{ visitorEmail: ci(email) }] : [])],
  };
  const chats = await prisma.chatConversation.findMany({
    where: chatWhere,
    orderBy: { createdAt: "desc" },
    select: {
      visitorName: true,
      visitorEmail: true,
      visitorPhone: true,
      contextKind: true,
      contextLabel: true,
      status: true,
      createdAt: true,
      closedAt: true,
      messages: {
        // Lines only the house sees are not part of her conversation.
        where: { internal: false },
        orderBy: { createdAt: "asc" },
        select: {
          author: true,
          body: true,
          createdAt: true,
          revisions: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
          attachments: { select: { originalName: true, mime: true, bytes: true } },
        },
      },
    },
  });

  const [
    addresses,
    reviews,
    testimonials,
    points,
    referrals,
    wishlist,
    savedCards,
    subscriber,
    preference,
    notificationPrefs,
  ] = await Promise.all([
    prisma.address.findMany({
      where: { userId },
      select: {
        label: true,
        firstName: true,
        lastName: true,
        phone: true,
        street: true,
        addressLine2: true,
        postalCode: true,
        city: true,
        state: true,
        country: true,
        isDefault: true,
      },
    }),
    prisma.review.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        rating: true,
        title: true,
        body: true,
        isApproved: true,
        testimonialImage: true,
        createdAt: true,
        product: { select: { name: true } },
      },
    }),
    prisma.testimonial.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        displayName: true,
        location: true,
        body: true,
        rating: true,
        clientImage: true,
        isApproved: true,
        createdAt: true,
      },
    }),
    prisma.pointsTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { type: true, amount: true, balanceAfter: true, description: true, expiresAt: true, createdAt: true },
    }),
    // Other people's details stay out: only when each referral joined.
    prisma.user.findMany({ where: { referredById: userId }, select: { createdAt: true } }),
    prisma.wishlistItem.findMany({
      where: { userId },
      select: { createdAt: true, product: { select: { name: true, slug: true } } },
    }),
    prisma.savedPaymentMethod.findMany({
      where: { userId },
      select: {
        gateway: true,
        paystackCardBrand: true,
        paystackCardLast4: true,
        paystackCardExpiry: true,
        stripeCardBrand: true,
        stripeCardLast4: true,
        stripeCardExpiry: true,
        nickname: true,
        isDefault: true,
        createdAt: true,
      },
    }),
    prisma.newsletterSubscriber.findUnique({
      where: { email: emailNorm },
      select: { createdAt: true, consentAt: true, consentSource: true, unsubscribedAt: true },
    }),
    prisma.emailPreference.findUnique({
      where: { email: emailNorm },
      select: { unsubscribedAt: true, bounceAt: true },
    }),
    getNotificationPrefs(userId),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    about:
      "Your personal data held by Prudent Gabriel. Records filed under your email are included once that email is confirmed.",
    profile: {
      name: user.name,
      email: user.email,
      emailConfirmedAt: user.emailVerified,
      phone: user.phone,
      photo: user.image,
      birthday: user.birthdayDay && user.birthdayMonth ? { day: user.birthdayDay, month: user.birthdayMonth } : null,
      accountCreatedAt: user.createdAt,
      lastSignInAt: user.lastLogin,
      preferredPaymentGateway: user.preferredGateway,
      referralCode: user.referralCode,
      joinedThroughReferral: Boolean(user.referredById),
      prudentPointsBalance: user.pointsBalance,
    },
    marketing: {
      consentAt: user.marketingConsentAt,
      consentSource: user.marketingConsentSource,
      newsletter: subscriber,
      unsubscribedAt: preference?.unsubscribedAt ?? null,
      bouncedAt: preference?.bounceAt ?? null,
      notificationPreferences: notificationPrefs,
    },
    addresses,
    clientProfile: profile
      ? {
          preferredSilhouettes: profile.preferredSilhouettes,
          preferredColors: profile.preferredColors,
          occasions: profile.occasions,
          budgetRange: profile.budgetRange,
          loyaltyTier: profile.loyaltyTier,
          loyaltyPoints: profile.loyaltyPoints,
          totalSpend: profile.totalSpend,
          createdAt: profile.createdAt,
          measurements: profile.measurements,
          moodboards: profile.moodboards,
          eventDates: profile.eventDates,
        }
      : null,
    orders: orders.map(withoutId).map(({ items, ...o }) => ({
      ...o,
      items: items.map(({ product, ...it }) => ({ product: product.name, ...it })),
    })),
    payments: payments.map((p) => ({
      reference: p.reference,
      amount: p.amount.toString(),
      currency: p.currency,
      method: p.method,
      status: p.status,
      purpose: p.purpose,
      date: p.confirmedAt ?? p.createdAt,
      for:
        p.order?.orderNumber ??
        p.bespokeOrder?.orderRef ??
        p.consultation?.bookingNumber ??
        p.invoice?.invoiceNumber ??
        null,
    })),
    consultationBookings: bookings.map(withoutId),
    consultationEnquiries: enquiries,
    bespokeCommissions: commissions.map(withoutId),
    bespokeRequests,
    reviews: reviews.map(({ product, ...r }) => ({ product: product?.name ?? null, ...r })),
    testimonials,
    pointsHistory: points,
    referrals: { count: referrals.length, joined: referrals.map((r) => r.createdAt) },
    wishlist: wishlist.map((w) => ({ product: w.product.name, slug: w.product.slug, addedAt: w.createdAt })),
    chats: chats.map((c) => ({
      ...c,
      messages: c.messages.map((m) => ({
        from: m.author,
        text: m.revisions[0]?.body ?? m.body,
        at: m.createdAt,
        attachments: m.attachments.map((a) => a.originalName),
      })),
    })),
    savedPaymentMethods: savedCards.map((c) => ({
      gateway: c.gateway,
      brand: c.paystackCardBrand ?? c.stripeCardBrand,
      last4: c.paystackCardLast4 ?? c.stripeCardLast4,
      expiry: c.paystackCardExpiry ?? c.stripeCardExpiry,
      nickname: c.nickname,
      isDefault: c.isDefault,
      addedAt: c.createdAt,
    })),
  };
}

/** Internal row ids mean nothing to her; the human references (order number etc.) stay. */
function withoutId<T extends { id: string }>(row: T): Omit<T, "id"> {
  const { id, ...rest } = row;
  void id;
  return rest;
}
