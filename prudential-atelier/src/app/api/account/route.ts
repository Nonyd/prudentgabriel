import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import Stripe from "stripe";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/logger";
import { provenEmail } from "@/lib/email-verification";
import { chatFileKeys, deleteOrphanedChatFiles } from "@/lib/chat-files";
import { destroyStoredMedia } from "@/lib/media/destroy";
import { keyFromMediaUrl } from "@/lib/media";
import { getStripeSecret } from "@/lib/payments/config";
import { deletedAccountEmail } from "@/lib/marketing-consent-copy";

const deleteSchema = z.object({ confirm: z.literal("DELETE") });

/** Folder the account upload route writes to: only these files are hers to destroy. */
const CUSTOMER_UPLOAD_FOLDER = "avatars/customer/";

function ci(email: string): Prisma.StringFilter {
  return { equals: email, mode: "insensitive" };
}

function isCustomerUpload(url: string | null | undefined): url is string {
  if (!url) return false;
  const key = keyFromMediaUrl(url);
  return Boolean(key && key.includes(CUSTOMER_UPLOAD_FOLDER));
}

/**
 * Close her account (right to erasure, NDPA 2023 s.36 / GDPR Art. 17).
 *
 * Erased in one transaction: sign-ins (sessions, linked accounts, reset and
 * verification tokens), addresses, measurements and style profile, moodboards,
 * event dates, wishlist, cart, saved cards, notifications, notification
 * preferences, chats (and their files after commit), unfinished checkouts,
 * birthday and marketing consent. Her address is unsubscribed from marketing.
 *
 * Kept, by law or contract: orders, payments, invoices, commissions and
 * consultation records (statutory financial-record retention). The User row
 * stays, anonymised, because those records point at it. Reviews stay without
 * her photo; testimonials stay as "Former client".
 *
 * The activity log line carries her user id and a hash of the old address,
 * never the address itself.
 */
export async function DELETE(req: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  // The middleware already refuses this while viewing as a client; belt and braces.
  if (gate.session.user.viewAs) {
    return NextResponse.json({ error: "Not while viewing as a client." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });
  }

  const userId = gate.session.user.id!;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, image: true, clientProfile: { select: { id: true } } },
    });
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const oldEmail = user.email.trim().toLowerCase();
    const proven = await provenEmail(userId);
    const profileId = user.clientProfile?.id ?? null;

    // Read what lives outside the database before the rows go.
    const [moodboards, testimonials, reviews, stripeCards, chats] = await Promise.all([
      profileId
        ? prisma.moodboard.findMany({ where: { clientId: profileId }, select: { images: true } })
        : Promise.resolve([] as { images: string[] }[]),
      prisma.testimonial.findMany({ where: { userId }, select: { clientImage: true } }),
      prisma.review.findMany({ where: { userId }, select: { testimonialImage: true } }),
      prisma.savedPaymentMethod.findMany({
        where: { userId, stripePaymentMethodId: { not: null } },
        select: { stripePaymentMethodId: true },
      }),
      prisma.chatConversation.findMany({
        where: { OR: [{ userId }, ...(proven ? [{ visitorEmail: ci(proven) }] : [])] },
        select: { id: true },
      }),
    ]);
    const chatIds = chats.map((c) => c.id);
    const chatKeys = await chatFileKeys(chatIds);
    const mediaUrls = Array.from(
      new Set(
        [
          user.image,
          ...moodboards.flatMap((m) => m.images),
          ...testimonials.map((t) => t.clientImage),
          ...reviews.map((r) => r.testimonialImage),
        ].filter(isCustomerUpload),
      ),
    );

    const now = new Date();
    await prisma.$transaction(
      async (tx) => {
        // Sign-ins. passwordChangedAt below also rejects any JWT already issued.
        await tx.session.deleteMany({ where: { userId } });
        await tx.account.deleteMany({ where: { userId } });
        await tx.passwordResetToken.deleteMany({ where: { userId } });
        await tx.verificationToken.deleteMany({
          where: { OR: [{ identifier: { startsWith: `verify-email:${userId}:` } }, { identifier: oldEmail }] },
        });

        // Orders keep their own address snapshot; the FK on Order.addressId is SET NULL.
        await tx.address.deleteMany({ where: { userId } });
        await tx.wishlistItem.deleteMany({ where: { userId } });
        await tx.cartItem.deleteMany({ where: { userId } });
        await tx.savedPaymentMethod.deleteMany({ where: { userId } });
        await tx.customerNotification.deleteMany({ where: { userId } });
        await tx.siteSetting.deleteMany({ where: { key: `notification_prefs_${userId}` } });
        // Unfinished checkouts only; one that became an order is part of that order.
        await tx.checkoutSession.deleteMany({
          where: {
            orderId: null,
            OR: [{ userId }, ...(proven ? [{ email: ci(proven) }] : [])],
          },
        });

        if (profileId) {
          await tx.measurement.deleteMany({ where: { clientId: profileId } });
          await tx.moodboard.deleteMany({ where: { clientId: profileId } });
          await tx.eventDate.deleteMany({ where: { clientId: profileId } });
          await tx.clientProfile.update({
            where: { id: profileId },
            data: {
              preferredSilhouettes: [],
              preferredColors: [],
              occasions: [],
              budgetRange: null,
              dateOfBirth: null,
            },
          });
        }

        // Messages and attachment rows cascade from the conversation.
        if (chatIds.length) await tx.chatConversation.deleteMany({ where: { id: { in: chatIds } } });

        await tx.testimonial.updateMany({
          where: { userId },
          data: { displayName: "Former client", location: null, clientImage: null },
        });
        await tx.review.updateMany({ where: { userId }, data: { testimonialImage: null } });

        // Her old address gets no more marketing, even if someone signs it up again.
        await tx.emailPreference.upsert({
          where: { email: oldEmail },
          create: { email: oldEmail, unsubscribedAt: now },
          update: {},
        });
        await tx.emailPreference.updateMany({
          where: { email: oldEmail, unsubscribedAt: null },
          data: { unsubscribedAt: now },
        });
        await tx.newsletterSubscriber.updateMany({
          where: { email: oldEmail, unsubscribedAt: null },
          data: { unsubscribedAt: now },
        });

        await tx.user.update({
          where: { id: userId },
          data: {
            name: "Deleted User",
            email: deletedAccountEmail(userId),
            emailVerified: null,
            password: null,
            phone: null,
            image: null,
            displayName: null,
            birthdayDay: null,
            birthdayMonth: null,
            birthdayWishedYear: null,
            marketingConsentAt: null,
            marketingConsentSource: null,
            preferredGateway: null,
            mustResetPassword: false,
            isActive: false,
            passwordChangedAt: now,
          },
        });

        await tx.activityLog.create({
          data: {
            userId,
            action: "DELETE",
            module: "account",
            description: "Account closed by the account holder (personal data erased; financial records kept)",
            recordId: userId,
            recordType: "User",
            snapshot: {
              emailSha256: createHash("sha256").update(oldEmail).digest("hex"),
              chats: chatIds.length,
              files: mediaUrls.length + chatKeys.length,
            },
          },
        });
      },
      { timeout: 30_000, maxWait: 10_000 },
    );

    // After commit, best effort: files, then cards at the gateway.
    await deleteOrphanedChatFiles(chatKeys).catch(() => undefined);
    for (const url of mediaUrls) {
      // A moodboard picture may also sit on a commission or consultation the house keeps.
      const [onCommission, onBooking] = await Promise.all([
        prisma.bespokeOrder.count({ where: { moodboardImages: { has: url } } }),
        prisma.consultationBooking.count({
          where: { OR: [{ moodboardImages: { has: url } }, { referenceImages: { has: url } }] },
        }),
      ]);
      if (onCommission + onBooking > 0) continue;
      await destroyStoredMedia(url).catch((error) =>
        logServerError({ errorType: "ACCOUNT_DELETE_MEDIA", error, userId }),
      );
    }
    if (stripeCards.length) {
      const stripeKey = await getStripeSecret().catch(() => null);
      if (stripeKey) {
        const stripe = new Stripe(stripeKey);
        for (const c of stripeCards) {
          if (c.stripePaymentMethodId) {
            await stripe.paymentMethods.detach(c.stripePaymentMethodId).catch(() => null);
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    await logServerError({ errorType: "ACCOUNT_DELETE", error: e, userId, severity: "WARNING" });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
