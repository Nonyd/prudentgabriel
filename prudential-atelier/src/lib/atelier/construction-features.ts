import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Slice BC2 — what the gown is. The house defines construction features once
 * (as Slice R does for measurement fields) and ticks them per commission, with
 * room for a note. Structured so "which gowns had a cup corset" is a query.
 *
 * The four the 30 September meeting named are seeded by the BC migration; the
 * house adds the rest from the admin without a deploy.
 */

export const SEEDED_FEATURE_KEYS = ["mermaid", "cup_corset", "train", "long_sleeves"] as const;

export const FEATURE_NOTE_MAX = 400;

/** "Cup corset" → "cup_corset". Keys are stable; labels can be renamed. */
export function featureKeyFromLabel(label: string): string {
  return label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** `feature=cup_corset,train` → ["cup_corset","train"] (deduped, max 10). */
export function parseFeatureKeys(value: string | null | undefined): string[] {
  if (!value) return [];
  const keys = value
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter((k) => /^[a-z0-9_]{1,40}$/.test(k));
  return Array.from(new Set(keys)).slice(0, 10);
}

/** Commissions carrying every one of `keys` (all-of: "mermaid AND train"). */
export function commissionHasFeaturesWhere(keys: string[]): Prisma.BespokeOrderWhereInput {
  if (keys.length === 0) return {};
  return { AND: keys.map((key) => ({ features: { some: { feature: { key } } } })) };
}

export type SpecItemInput = { featureId: string; note?: string | null };

/** Validate a PUT body: unique feature ids, trimmed notes. */
export function parseSpecItems(raw: unknown): { ok: true; items: SpecItemInput[] } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { items?: unknown }).items)) {
    return { ok: false, error: "items must be an array" };
  }
  const seen = new Set<string>();
  const items: SpecItemInput[] = [];
  for (const row of (raw as { items: unknown[] }).items) {
    if (!row || typeof row !== "object") return { ok: false, error: "Each item needs a featureId" };
    const featureId = (row as { featureId?: unknown }).featureId;
    if (typeof featureId !== "string" || !featureId) return { ok: false, error: "Each item needs a featureId" };
    if (seen.has(featureId)) continue;
    seen.add(featureId);
    const noteRaw = (row as { note?: unknown }).note;
    const note = typeof noteRaw === "string" ? noteRaw.trim().slice(0, FEATURE_NOTE_MAX) || null : null;
    items.push({ featureId, note });
  }
  return { ok: true, items };
}

export const specificationInclude = {
  features: {
    include: { feature: { select: { id: true, key: true, label: true, group: true, sortOrder: true, archivedAt: true } } },
  },
} satisfies Prisma.BespokeOrderInclude;

export { specificationRows, type SpecificationRow } from "@/lib/atelier/spec-rows";

/**
 * Replace a commission's specification with `items`. Features not in the list
 * are unticked; notes are updated in place. Archived features may stay on a
 * commission that already had them but cannot be newly ticked.
 */
export async function replaceSpecification(
  orderId: string,
  items: SpecItemInput[],
  actorId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ids = items.map((i) => i.featureId);
  const [features, existing] = await Promise.all([
    prisma.constructionFeature.findMany({ where: { id: { in: ids } }, select: { id: true, archivedAt: true } }),
    prisma.commissionFeature.findMany({ where: { orderId }, select: { featureId: true } }),
  ]);
  const known = new Map(features.map((f) => [f.id, f]));
  const had = new Set(existing.map((e) => e.featureId));
  for (const id of ids) {
    const f = known.get(id);
    if (!f) return { ok: false, error: "Unknown feature" };
    if (f.archivedAt && !had.has(id)) return { ok: false, error: "That feature has been retired" };
  }

  await prisma.$transaction([
    prisma.commissionFeature.deleteMany({ where: { orderId, featureId: { notIn: ids } } }),
    ...items.map((item) =>
      prisma.commissionFeature.upsert({
        where: { orderId_featureId: { orderId, featureId: item.featureId } },
        create: { orderId, featureId: item.featureId, note: item.note ?? null, addedById: actorId },
        update: { note: item.note ?? null },
      }),
    ),
  ]);
  return { ok: true };
}
