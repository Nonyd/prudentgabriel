import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import {
  getMergedAccountProfile,
  getNotificationPrefs,
  getOrCreateClientProfile,
  saveNotificationPrefs,
  syncClientLoyaltyTier,
} from "@/lib/account-helpers";
import { getTierThresholds, tierFromPoints, pointsToNextTier, nextTier, TIER_LABELS } from "@/lib/loyalty";
import { prisma } from "@/lib/prisma";
import { logActivity, logError } from "@/lib/logger";

const patchSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  image: z.string().url().optional().or(z.literal("")),
  preferredSilhouettes: z.array(z.string()).optional(),
  preferredColors: z.array(z.string()).optional(),
  occasions: z.array(z.string()).optional(),
  budgetRange: z.string().nullable().optional(),
  notificationPrefs: z
    .object({
      orderStage: z.boolean().optional(),
      newCollections: z.boolean().optional(),
      wishlistRestock: z.boolean().optional(),
      eventReminders: z.boolean().optional(),
    })
    .optional(),
});

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  try {
    const merged = await getMergedAccountProfile(gate.session.user.id!);
    if (!merged) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const thresholds = await getTierThresholds();
    const tier = tierFromPoints(merged.user.pointsBalance, thresholds);
    const notificationPrefs = await getNotificationPrefs(gate.session.user.id!);

    const parts = (merged.user.name ?? "").trim().split(/\s+/);

    return NextResponse.json({
      firstName: parts[0] ?? "",
      lastName: parts.slice(1).join(" "),
      email: merged.user.email,
      phone: merged.user.phone,
      image: merged.user.image,
      pointsBalance: merged.user.pointsBalance,
      referralCode: merged.user.referralCode,
      profile: merged.profile,
      loyalty: {
        tier,
        tierLabel: TIER_LABELS[tier],
        nextTier: nextTier(tier),
        pointsToNext: pointsToNextTier(merged.user.pointsBalance, tier, thresholds),
        thresholds,
      },
      notificationPrefs,
    });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_PROFILE_GET",
      message: e instanceof Error ? e.message : "Failed to get profile",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const userId = gate.session.user.id!;
  const data = parsed.data;

  try {
    const profile = await getOrCreateClientProfile(userId);

    if (
      data.firstName != null ||
      data.lastName != null ||
      data.phone !== undefined ||
      data.image !== undefined
    ) {
      const name =
        data.firstName != null || data.lastName != null
          ? `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim()
          : undefined;

      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(name ? { name } : {}),
          ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
          ...(data.image !== undefined ? { image: data.image || null } : {}),
        },
      });
    }

    const profileUpdate: Record<string, unknown> = {};
    if (data.preferredSilhouettes) profileUpdate.preferredSilhouettes = data.preferredSilhouettes;
    if (data.preferredColors) profileUpdate.preferredColors = data.preferredColors;
    if (data.occasions) profileUpdate.occasions = data.occasions;
    if (data.budgetRange !== undefined) profileUpdate.budgetRange = data.budgetRange;

    let updatedProfile = profile;
    if (Object.keys(profileUpdate).length > 0) {
      updatedProfile = await prisma.clientProfile.update({
        where: { id: profile.id },
        data: profileUpdate,
      });
    }

    if (data.notificationPrefs) {
      const current = await getNotificationPrefs(userId);
      await saveNotificationPrefs(userId, { ...current, ...data.notificationPrefs });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pointsBalance: true },
    });
    if (user) await syncClientLoyaltyTier(userId, user.pointsBalance);

    await logActivity({
      userId,
      userEmail: gate.session.user.email ?? undefined,
      action: "UPDATE",
      module: "account",
      description: "Updated account profile",
      recordId: updatedProfile.id,
      recordType: "ClientProfile",
    });

    return NextResponse.json({ ok: true, profile: updatedProfile });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_PROFILE_PATCH",
      message: e instanceof Error ? e.message : "Failed to update profile",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
