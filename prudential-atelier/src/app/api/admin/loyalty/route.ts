import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { ensureLoyaltySettingKeys } from "@/lib/loyalty-settings-bootstrap";
import { getExpiryMonths, getMinRedemptionPoints, getPointRateNGN, outstandingPointsTotal, pointsToNaira } from "@/lib/points";
import { setSetting, clearSettingCacheKey } from "@/lib/settings";
import { LOYALTY_ACTIONS, NGN_PER_EARN_UNIT, PRUDENT_POINTS_COPY, SETTING_KEYS } from "@/lib/points-value";

const patchSchema = z.object({
  rateNGN: z.number().positive().optional(),
  minRedemption: z.number().int().min(0).optional(),
  expiryMonths: z.number().int().positive().optional(),
  rules: z
    .array(
      z.object({
        action: z.string().min(1),
        points: z.number().int().min(0),
        isActive: z.boolean(),
      }),
    )
    .optional(),
});

const RULE_LABELS: Record<string, string> = {
  [LOYALTY_ACTIONS.SIGNUP]: "Welcome bonus on registration (keep at 0 — referral pays on first order)",
  [LOYALTY_ACTIONS.PURCHASE_PER_10]: "Points per ₦10 of cash spent on the garment (not shipping, not points)",
  [LOYALTY_ACTIONS.REFERRAL_FIRST_ORDER]: "Referrer reward when the friend completes a first paid order",
  [LOYALTY_ACTIONS.REVIEW]: "Verified product review after delivery",
  [LOYALTY_ACTIONS.NEWSLETTER]: "Newsletter signup",
  [LOYALTY_ACTIONS.BIRTHDAY]: "Birthday, each year",
  [LOYALTY_ACTIONS.STYLE_PROFILE]: "Complete style profile",
};

const SAMPLE_GARMENT_NGN = 250_000;

export async function GET() {
  const gate = await requireAdminApi("settings");
  if (!gate.ok) return gate.response;

  await ensureLoyaltySettingKeys();

  const [rateNGN, outstanding, rules, history, minRedemption, expiryMonths] = await Promise.all([
    getPointRateNGN(),
    outstandingPointsTotal(),
    prisma.loyaltyRule.findMany({ orderBy: { action: "asc" } }),
    prisma.pointRateHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { changedBy: { select: { name: true, email: true } } },
    }),
    getMinRedemptionPoints(),
    getExpiryMonths(),
  ]);

  const liabilityNGN = pointsToNaira(outstanding, rateNGN);

  const earningCost = rules
    .filter((r) => r.isActive && r.action !== "SIGNUP_REFERRAL" && r.action !== "PURCHASE_PER_100")
    .map((r) => {
      const nairaEach =
        r.action === LOYALTY_ACTIONS.PURCHASE_PER_10
          ? r.points * rateNGN * (SAMPLE_GARMENT_NGN / NGN_PER_EARN_UNIT)
          : pointsToNaira(r.points, rateNGN);
      const referralsForSample =
        r.action === LOYALTY_ACTIONS.REFERRAL_FIRST_ORDER && r.points > 0
          ? Math.ceil(SAMPLE_GARMENT_NGN / pointsToNaira(r.points, rateNGN))
          : null;
      return {
        action: r.action,
        label: RULE_LABELS[r.action] ?? r.action.replace(/_/g, " "),
        points: r.points,
        isActive: r.isActive,
        nairaEach: r.action === LOYALTY_ACTIONS.PURCHASE_PER_10 ? r.points * rateNGN : pointsToNaira(r.points, rateNGN),
        referralsForSample,
        spendNote:
          r.action === LOYALTY_ACTIONS.PURCHASE_PER_10
            ? `A ₦${SAMPLE_GARMENT_NGN.toLocaleString("en-NG")} dress earns ${Math.floor(SAMPLE_GARMENT_NGN / NGN_PER_EARN_UNIT) * r.points} points (${nairaEach.toLocaleString("en-NG")} naira back)`
            : null,
      };
    });

  return NextResponse.json({
    rateNGN,
    minRedemption,
    expiryMonths,
    copy: PRUDENT_POINTS_COPY,
    outstandingPoints: outstanding,
    liabilityNGN,
    sampleGarmentNGN: SAMPLE_GARMENT_NGN,
    rules: earningCost,
    history: history.map((h) => ({
      id: h.id,
      rateNGN: h.rateNGN,
      previousRateNGN: h.previousRateNGN,
      outstandingPoints: h.outstandingPoints,
      liabilityNGN: h.liabilityNGN,
      changedBy: h.changedBy?.name ?? h.changedBy?.email ?? "Staff",
      createdAt: h.createdAt,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdminApi("settings");
  if (!gate.ok) return gate.response;

  await ensureLoyaltySettingKeys();

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

  const userId = gate.session.user!.id!;
  const currentRate = await getPointRateNGN();

  if (parsed.data.rateNGN != null && parsed.data.rateNGN !== currentRate) {
    const outstanding = await outstandingPointsTotal();
    await prisma.pointRateHistory.create({
      data: {
        rateNGN: parsed.data.rateNGN,
        previousRateNGN: currentRate,
        changedById: userId,
        outstandingPoints: outstanding,
        liabilityNGN: pointsToNaira(outstanding, parsed.data.rateNGN),
      },
    });
    await setSetting(SETTING_KEYS.rateNGN, String(parsed.data.rateNGN), userId);
  }

  if (parsed.data.minRedemption != null) {
    await setSetting(SETTING_KEYS.minRedemption, String(parsed.data.minRedemption), userId);
  }

  if (parsed.data.expiryMonths != null) {
    await setSetting(SETTING_KEYS.expiryMonths, String(parsed.data.expiryMonths), userId);
  }

  if (parsed.data.rules) {
    for (const rule of parsed.data.rules) {
      if (rule.action === "SIGNUP_REFERRAL" || rule.action === "PURCHASE_PER_100") continue;
      await prisma.loyaltyRule.upsert({
        where: { action: rule.action },
        create: { action: rule.action, points: rule.points, isActive: rule.isActive },
        update: { points: rule.points, isActive: rule.isActive },
      });
    }
  }

  clearSettingCacheKey(SETTING_KEYS.rateNGN);
  clearSettingCacheKey(SETTING_KEYS.minRedemption);
  clearSettingCacheKey(SETTING_KEYS.expiryMonths);
  clearSettingCacheKey(SETTING_KEYS.rateNGNLegacy);
  clearSettingCacheKey(SETTING_KEYS.minRedemptionLegacy);

  return NextResponse.json({ ok: true });
}
