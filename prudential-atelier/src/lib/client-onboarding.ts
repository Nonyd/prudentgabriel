import bcrypt from "bcryptjs";
import { PointsType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLoyaltyRulePoints } from "@/lib/loyalty";
import { tierFromPoints, getTierThresholds } from "@/lib/loyalty";
import { sendWelcomeCredentialsEmail } from "@/lib/email";
import { getPublicAppUrl } from "@/lib/app-url";
import { generateTempPassword } from "@/lib/temp-password";

export type OnboardSource = "CONSULTATION" | "RTW_ORDER" | "BESPOKE_ORDER";

function firstNameFromName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export async function autoOnboardClient(params: {
  name: string;
  email: string;
  phone?: string;
  source: OnboardSource;
  sourceId: string;
}): Promise<{ userId: string; isNew: boolean; tempPassword?: string }> {
  const email = params.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    if (params.source === "RTW_ORDER") {
      await prisma.order.updateMany({
        where: { id: params.sourceId, userId: null },
        data: { userId: existing.id },
      });
    } else if (params.source === "CONSULTATION") {
      await prisma.consultationBooking.updateMany({
        where: { id: params.sourceId, userId: null },
        data: { userId: existing.id },
      });
    } else if (params.source === "BESPOKE_ORDER") {
      const order = await prisma.bespokeOrder.findUnique({
        where: { id: params.sourceId },
        select: { clientProfileId: true },
      });
      if (order && !order.clientProfileId) {
        const profile = await prisma.clientProfile.findUnique({
          where: { userId: existing.id },
          select: { id: true },
        });
        if (profile) {
          await prisma.bespokeOrder.update({
            where: { id: params.sourceId },
            data: { clientProfileId: profile.id },
          });
        }
      }
    }
    return { userId: existing.id, isNew: false };
  }

  const tempPassword = generateTempPassword();
  const hashedPassword = await bcrypt.hash(tempPassword, 12);
  const signupPoints = await getLoyaltyRulePoints("SIGNUP");
  const thresholds = await getTierThresholds();

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: params.name.trim(),
        email,
        phone: params.phone?.trim() || null,
        password: hashedPassword,
        mustResetPassword: true,
        ...(signupPoints > 0 ? { pointsBalance: signupPoints } : {}),
      },
    });

    if (signupPoints > 0) {
      await tx.pointsTransaction.create({
        data: {
          userId: created.id,
          type: PointsType.EARNED_SIGNUP,
          amount: signupPoints,
          balanceAfter: signupPoints,
          description: "Welcome bonus",
        },
      });
    }

    const tier = tierFromPoints(signupPoints, thresholds);
    await tx.clientProfile.create({
      data: {
        userId: created.id,
        loyaltyPoints: signupPoints,
        loyaltyTier: tier,
      },
    });

    if (params.source === "RTW_ORDER") {
      await tx.order.update({
        where: { id: params.sourceId },
        data: { userId: created.id, guestEmail: null, guestName: null, guestPhone: null },
      });
    } else if (params.source === "CONSULTATION") {
      await tx.consultationBooking.update({
        where: { id: params.sourceId },
        data: { userId: created.id },
      });
    } else if (params.source === "BESPOKE_ORDER") {
      const profile = await tx.clientProfile.findUnique({
        where: { userId: created.id },
        select: { id: true },
      });
      if (profile) {
        await tx.bespokeOrder.update({
          where: { id: params.sourceId },
          data: { clientProfileId: profile.id },
        });
      }
    }

    return created;
  });

  const sourceLabel =
    params.source === "CONSULTATION"
      ? "consultation"
      : params.source === "BESPOKE_ORDER"
        ? "bespoke order"
        : "order";

  const trackToken =
    params.source === "RTW_ORDER"
      ? await prisma.order.findUnique({ where: { id: params.sourceId }, select: { orderNumber: true } })
      : params.source === "CONSULTATION"
        ? await prisma.consultationBooking.findUnique({
            where: { id: params.sourceId },
            select: { bookingNumber: true },
          })
        : await prisma.bespokeOrder.findUnique({
            where: { id: params.sourceId },
            select: { trackingToken: true },
          });

  let trackUrl = `${getPublicAppUrl()}/account`;
  if (params.source === "RTW_ORDER" && trackToken && "orderNumber" in trackToken) {
    trackUrl = `${getPublicAppUrl()}/track/${encodeURIComponent(trackToken.orderNumber)}`;
  } else if (params.source === "CONSULTATION" && trackToken && "bookingNumber" in trackToken) {
    trackUrl = `${getPublicAppUrl()}/consultation/${encodeURIComponent(trackToken.bookingNumber)}`;
  } else if (params.source === "BESPOKE_ORDER" && trackToken && "trackingToken" in trackToken) {
    trackUrl = `${getPublicAppUrl()}/track/${encodeURIComponent(trackToken.trackingToken)}`;
  }

  void sendWelcomeCredentialsEmail({
    to: email,
    firstName: firstNameFromName(params.name),
    email,
    tempPassword,
    sourceLabel,
    trackUrl,
  }).catch((e) => console.warn("[autoOnboardClient] email", e));

  return { userId: user.id, isNew: true, tempPassword };
}
