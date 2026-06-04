import type { ClientProfile, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { tierFromPoints, getTierThresholds } from "@/lib/loyalty";

export async function getOrCreateClientProfile(userId: string): Promise<ClientProfile> {
  const existing = await prisma.clientProfile.findUnique({ where: { userId } });
  if (existing) return existing;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pointsBalance: true, referredById: true },
  });

  const thresholds = await getTierThresholds();
  const tier = tierFromPoints(user?.pointsBalance ?? 0, thresholds);

  return prisma.clientProfile.create({
    data: {
      userId,
      loyaltyPoints: user?.pointsBalance ?? 0,
      loyaltyTier: tier,
      referredBy: user?.referredById ?? undefined,
    },
  });
}

export async function syncClientLoyaltyTier(userId: string, pointsBalance: number): Promise<void> {
  const profile = await prisma.clientProfile.findUnique({ where: { userId } });
  if (!profile) return;
  const thresholds = await getTierThresholds();
  const tier = tierFromPoints(pointsBalance, thresholds);
  await prisma.clientProfile.update({
    where: { id: profile.id },
    data: { loyaltyPoints: pointsBalance, loyaltyTier: tier },
  });
}

export type MergedAccountProfile = {
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    image: string | null;
    pointsBalance: number;
    referralCode: string;
  };
  profile: ClientProfile;
};

export async function getMergedAccountProfile(userId: string): Promise<MergedAccountProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      pointsBalance: true,
      referralCode: true,
    },
  });
  if (!user) return null;

  const profile = await getOrCreateClientProfile(userId);
  return { user, profile };
}

export function styleProfileComplete(profile: ClientProfile): boolean {
  return (
    profile.preferredSilhouettes.length > 0 ||
    profile.preferredColors.length > 0 ||
    profile.occasions.length > 0 ||
    Boolean(profile.budgetRange)
  );
}

export async function getNotificationPrefs(userId: string): Promise<Record<string, boolean>> {
  const key = `notification_prefs_${userId}`;
  const setting = await prisma.siteSetting.findUnique({ where: { key } });
  if (!setting?.value) {
    return {
      orderStage: true,
      newCollections: true,
      wishlistRestock: true,
      eventReminders: true,
    };
  }
  try {
    return JSON.parse(setting.value) as Record<string, boolean>;
  } catch {
    return {
      orderStage: true,
      newCollections: true,
      wishlistRestock: true,
      eventReminders: true,
    };
  }
}

export async function saveNotificationPrefs(
  userId: string,
  prefs: Record<string, boolean>,
): Promise<void> {
  const key = `notification_prefs_${userId}`;
  await prisma.siteSetting.upsert({
    where: { key },
    create: {
      key,
      value: JSON.stringify(prefs),
      group: "NOTIFICATIONS",
      type: "JSON",
      label: "Notification preferences",
    },
    update: { value: JSON.stringify(prefs) },
  });
}

export type MeasurementFields = Pick<
  Prisma.MeasurementCreateInput,
  | "bust"
  | "waist"
  | "hips"
  | "shoulderWidth"
  | "sleeveLength"
  | "dressLength"
  | "thigh"
  | "inseam"
  | "neck"
  | "armhole"
  | "unit"
  | "notes"
>;
