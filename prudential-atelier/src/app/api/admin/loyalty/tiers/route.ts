import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { LoyaltyTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INTERACTIVE_TX } from "@/lib/prisma-tx";
import { requireAdminApi } from "@/lib/admin-auth";
import { TIER_LABELS, TIER_ORDER } from "@/lib/loyalty";
import { getTierConfigs, getTierPerks, recomputeAllClientTiers } from "@/lib/loyalty-tiers";
import { logLegallySignificantChange } from "@/lib/legal-tokens";
import { revalidateSettings } from "@/lib/revalidate";

const tierEnum = z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]);

const putSchema = z.object({
  tiers: z
    .array(
      z.object({
        tier: tierEnum,
        minSpendNGN: z.number().min(0),
        pointsPer100: z.number().int().min(0).max(100),
      }),
    )
    .length(4),
  perks: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().trim().min(1).max(160),
        tiers: z.array(tierEnum),
      }),
    )
    .max(60),
});

async function payload() {
  const [tiers, perks, counts] = await Promise.all([
    getTierConfigs(),
    getTierPerks(),
    prisma.clientProfile.groupBy({ by: ["loyaltyTier"], _count: { _all: true } }),
  ]);
  const members = Object.fromEntries(counts.map((c) => [c.loyaltyTier, c._count._all]));
  return {
    tiers: tiers.map((t) => ({ ...t, label: TIER_LABELS[t.tier], members: members[t.tier] ?? 0 })),
    perks,
  };
}

export async function GET() {
  const gate = await requireAdminApi("settings");
  if (!gate.ok) return gate.response;
  return NextResponse.json(await payload());
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdminApi("settings");
  if (!gate.ok) return gate.response;

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const byTier = new Map(parsed.data.tiers.map((t) => [t.tier, t]));
  const ordered = TIER_ORDER.map((t) => byTier.get(t));
  if (ordered.some((t) => !t)) return NextResponse.json({ error: "Send all four tiers" }, { status: 400 });
  for (let i = 2; i < ordered.length; i++) {
    if (ordered[i]!.minSpendNGN <= ordered[i - 1]!.minSpendNGN) {
      return NextResponse.json(
        { error: `${TIER_LABELS[TIER_ORDER[i]!]} must need more spend than ${TIER_LABELS[TIER_ORDER[i - 1]!]}` },
        { status: 400 },
      );
    }
  }

  const userId = gate.session.user!.id!;
  const [before, existingPerks] = await Promise.all([getTierConfigs(), getTierPerks()]);
  const existingById = new Map(existingPerks.map((p) => [p.id, p]));

  // Write only what changed, so a save stays a handful of statements.
  await prisma.$transaction(async (tx) => {
    for (const t of ordered) {
      const minSpendNGN = t!.tier === "BRONZE" ? 0 : t!.minSpendNGN;
      const prev = before.find((b) => b.tier === t!.tier);
      if (prev && prev.minSpendNGN === minSpendNGN && prev.pointsPer100 === t!.pointsPer100) continue;
      await tx.loyaltyTierConfig.upsert({
        where: { tier: t!.tier },
        create: { tier: t!.tier, minSpendNGN, pointsPer100: t!.pointsPer100, updatedBy: userId },
        update: { minSpendNGN, pointsPer100: t!.pointsPer100, updatedBy: userId },
      });
    }
    const keep = parsed.data.perks.map((p) => p.id).filter((id): id is string => Boolean(id));
    if (existingPerks.some((p) => !keep.includes(p.id))) {
      await tx.loyaltyPerk.deleteMany({ where: { id: { notIn: keep } } });
    }
    for (const [i, p] of parsed.data.perks.entries()) {
      const tiers = TIER_ORDER.filter((t) => p.tiers.includes(t)) as LoyaltyTier[];
      const prev = p.id ? existingById.get(p.id) : undefined;
      if (prev) {
        const same = prev.label === p.label && prev.sortOrder === i && prev.tiers.join() === tiers.join();
        if (!same) {
          await tx.loyaltyPerk.update({ where: { id: prev.id }, data: { label: p.label, tiers, sortOrder: i } });
        }
      } else {
        await tx.loyaltyPerk.create({ data: { label: p.label, tiers, sortOrder: i } });
      }
    }
  }, INTERACTIVE_TX);

  for (const t of ordered) {
    const prev = before.find((b) => b.tier === t!.tier)!;
    const next = { min: t!.tier === "BRONZE" ? 0 : t!.minSpendNGN, rate: t!.pointsPer100 };
    if (prev.minSpendNGN !== next.min || prev.pointsPer100 !== next.rate) {
      await logLegallySignificantChange({
        userId,
        userEmail: gate.session.user?.email ?? undefined,
        userRole: gate.session.user?.role ?? undefined,
        key: `loyalty_tier.${t!.tier}`,
        previous: `${prev.minSpendNGN}:${prev.pointsPer100}`,
        next: `${next.min}:${next.rate}`,
        recordType: "LoyaltyTierConfig",
      });
    }
  }

  // New levels apply to everyone at once. Silent: nobody is emailed for a settings change.
  const recompute = await recomputeAllClientTiers();
  await revalidateSettings();
  return NextResponse.json({ ok: true, moved: recompute.changed.length, ...(await payload()) });
}
