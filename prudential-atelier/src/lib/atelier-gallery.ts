/**
 * Slice BB3 — the atelier gallery is pieces, not frames.
 *
 * A gown photographed five times is one piece with five images, not five works.
 * A piece is its main photograph (pieceOfId null) plus every frame pointing at
 * it. The main photograph carries the piece's title (caption), description and
 * BA4 price guide; a frame's own values are ignored, so no number is typed twice.
 *
 * The same file uploaded twice is one frame: a repeated URL is dropped.
 *
 * Display only, like BA4: nothing chargeable reads any of this.
 */
import { priceGuideText, type PriceGuide } from "@/lib/price-guide";

export type GalleryRow = PriceGuide & {
  id: string;
  url: string;
  alt: string | null;
  caption: string | null;
  description: string | null;
  pieceOfId: string | null;
  /** Words and guide invented for review, not the house's (seed-atelier-demo.ts). */
  placeholder?: boolean;
};

export type AtelierPieceFrame = { id: string; url: string; alt: string };

export type AtelierPiece = {
  id: string;
  title: string | null;
  description: string | null;
  guide: PriceGuide;
  frames: AtelierPieceFrame[];
};

function clean(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/**
 * Placeholder words and prices may be shown only where the house is reviewing
 * them: staging, or a laptop. The site's own URL (baked into each image at
 * build) decides; any configured URL naming the production host refuses; an
 * unknown or missing URL refuses. (Staging's gallery is copied to production by
 * deploy/sync-storefront-from-staging.sh, so this must fail closed.)
 */
const PRODUCTION_HOST = /^https?:\/\/(www\.)?prudentgabriel\.com(:\d+)?(\/|$)/i;
const REVIEW_HOST = /^https?:\/\/(staging\.prudentgabriel\.com|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i;

export function placeholderContentVisible(siteUrl: string | undefined, otherUrls: Array<string | undefined> = []): boolean {
  const all = [siteUrl, ...otherUrls].map((u) => u?.trim() ?? "").filter(Boolean);
  if (all.some((u) => PRODUCTION_HOST.test(u))) return false;
  return Boolean(siteUrl?.trim()) && REVIEW_HOST.test(siteUrl!.trim());
}

/**
 * Rows arrive in public order (sortOrder, then newest). Pieces keep the order
 * of their main photograph; frames follow it in their own order. A frame whose
 * main photograph is not in `rows` (hidden, or another category) is left out:
 * hiding the piece hides all of it. Where placeholders may not be shown, a
 * placeholder piece is its photographs alone.
 */
export function groupAtelierPieces(
  rows: GalleryRow[],
  limit = 12,
  { showPlaceholders = false }: { showPlaceholders?: boolean } = {},
): AtelierPiece[] {
  const seenUrls = new Set<string>();
  const unique = rows.filter((row) => {
    const url = row.url.trim();
    if (!url || seenUrls.has(url)) return false;
    seenUrls.add(url);
    return true;
  });

  const heads = unique.filter((row) => !row.pieceOfId);
  const headIds = new Set(heads.map((row) => row.id));
  const framesOf = new Map<string, GalleryRow[]>();
  for (const row of unique) {
    if (!row.pieceOfId || !headIds.has(row.pieceOfId)) continue;
    const list = framesOf.get(row.pieceOfId) ?? [];
    list.push(row);
    framesOf.set(row.pieceOfId, list);
  }

  return heads.slice(0, limit).map((head) => {
    const words = !head.placeholder || showPlaceholders;
    const title = words ? clean(head.caption) : null;
    const alt = clean(head.alt) ?? title ?? "A piece from the atelier";
    return {
      id: head.id,
      title,
      description: words ? clean(head.description) : null,
      guide: words
        ? { priceFloorNGN: head.priceFloorNGN, priceCeilingNGN: head.priceCeilingNGN }
        : { priceFloorNGN: null, priceCeilingNGN: null },
      frames: [head, ...(framesOf.get(head.id) ?? [])].map((row, i) => ({
        id: row.id,
        url: row.url,
        alt: clean(row.alt) ?? (i === 0 ? alt : `${alt}, another view`),
      })),
    };
  });
}

/**
 * What a piece still needs from the house. Frames of a piece are never flagged.
 * An invented (placeholder) value still needs the real one.
 */
export type PieceGaps = { needsPriceGuide: boolean; needsDescription: boolean; placeholder: boolean };

export function pieceGaps(
  row: Pick<GalleryRow, "pieceOfId" | "description" | "priceFloorNGN" | "priceCeilingNGN" | "placeholder">,
): PieceGaps {
  if (row.pieceOfId) return { needsPriceGuide: false, needsDescription: false, placeholder: false };
  const placeholder = Boolean(row.placeholder);
  return {
    needsPriceGuide: placeholder || priceGuideText(row) === null,
    needsDescription: placeholder || clean(row.description) === null,
    placeholder,
  };
}

/**
 * A save by the house replaces invented values: the mark stays only while none
 * of the title, description or guide has changed (or it is kept on purpose).
 */
export function placeholderAfterSave(
  existing: Pick<GalleryRow, "caption" | "description" | "priceFloorNGN" | "priceCeilingNGN" | "placeholder">,
  input: { caption?: string | null; description?: string | null; priceFloorNGN?: number | null; priceCeilingNGN?: number | null; placeholder?: boolean },
): boolean {
  if (!existing.placeholder) return input.placeholder === true;
  if (input.placeholder === false) return false;
  const changed =
    (input.caption !== undefined && clean(input.caption) !== clean(existing.caption)) ||
    (input.description !== undefined && clean(input.description) !== clean(existing.description)) ||
    (input.priceFloorNGN !== undefined && input.priceFloorNGN !== existing.priceFloorNGN) ||
    (input.priceCeilingNGN !== undefined && input.priceCeilingNGN !== existing.priceCeilingNGN);
  return !changed;
}

type PieceRow = PriceGuide & {
  id: string;
  category: string;
  caption: string | null;
  description: string | null;
  pieceOfId: string | null;
};

export type PieceChangeInput = {
  pieceOfId?: string | null;
  description?: string | null;
  priceFloorNGN?: number | null;
  priceCeilingNGN?: number | null;
  /** The photograph is moving to another gallery in the same save. */
  moving: boolean;
};

export type PieceChangePlan = {
  /** Written to the photograph itself. A frame carries no words or guide of its own. */
  row: PriceGuide & { pieceOfId: string | null; description: string | null };
  /** Written to the piece it joins: only what the piece does not have yet. */
  head: { id: string; data: Partial<Pick<PieceRow, "caption" | "description" | "priceFloorNGN" | "priceCeilingNGN">> } | null;
  /** Its own frames, if it had any: they follow it into the piece, or stand alone when it leaves the gallery. */
  frames: { from: string; to: string | null } | null;
};

/** The piece a save asks this photograph to join, if it is joining one now (the route loads it). */
export function joiningPieceId(existing: Pick<PieceRow, "pieceOfId">, input: PieceChangeInput): string | null {
  if (input.moving || input.pieceOfId === undefined || !input.pieceOfId) return null;
  return input.pieceOfId !== existing.pieceOfId ? input.pieceOfId : null;
}

/**
 * BB3: what one admin save does to a photograph and its piece. Pieces are one
 * level deep and within one gallery; the piece's main photograph holds the
 * title, description and guide; nothing is typed twice or silently lost.
 */
export function planPieceChange(
  existing: PieceRow,
  input: PieceChangeInput,
  head: PieceRow | null,
): { error: string } | PieceChangePlan {
  const guide: PriceGuide = {
    priceFloorNGN: input.priceFloorNGN !== undefined ? input.priceFloorNGN : existing.priceFloorNGN,
    priceCeilingNGN: input.priceCeilingNGN !== undefined ? input.priceCeilingNGN : existing.priceCeilingNGN,
  };
  const description = input.description !== undefined ? clean(input.description) : clean(existing.description);
  const requested = input.pieceOfId !== undefined ? input.pieceOfId || null : existing.pieceOfId;
  const pieceOfId = input.moving ? null : requested;
  const joining = joiningPieceId(existing, input);

  if (joining) {
    if (joining === existing.id) return { error: "A photograph cannot belong to itself." };
    if (!head || head.id !== joining || head.category !== existing.category) {
      return { error: "Choose a piece from this gallery." };
    }
    if (head.pieceOfId) return { error: "Choose the piece's main photograph." };
  } else if (pieceOfId) {
    const ownWords =
      Boolean(clean(input.description)) || input.priceFloorNGN != null || input.priceCeilingNGN != null;
    if (ownWords) return { error: "Set the description and price guide on the piece's main photograph." };
  }

  const headData: NonNullable<PieceChangePlan["head"]>["data"] = {};
  if (joining && head) {
    if (!clean(head.caption) && clean(existing.caption)) headData.caption = existing.caption;
    if (!clean(head.description) && description) headData.description = description;
    if (head.priceFloorNGN == null && guide.priceFloorNGN != null) {
      headData.priceFloorNGN = guide.priceFloorNGN;
      headData.priceCeilingNGN = guide.priceCeilingNGN;
    }
  }

  return {
    row: pieceOfId
      ? { pieceOfId, description: null, priceFloorNGN: null, priceCeilingNGN: null }
      : { pieceOfId: null, description, ...guide },
    head: joining && head ? { id: head.id, data: headData } : null,
    frames: joining && head ? { from: existing.id, to: head.id } : input.moving ? { from: existing.id, to: null } : null,
  };
}

/** Rows whose file is already used by an earlier row: the same photograph uploaded twice. */
export function duplicateFileOf(rows: Array<{ id: string; url: string }>): Map<string, string> {
  const first = new Map<string, string>();
  const dupes = new Map<string, string>();
  for (const row of rows) {
    const url = row.url.trim();
    const earlier = first.get(url);
    if (earlier) dupes.set(row.id, earlier);
    else first.set(url, row.id);
  }
  return dupes;
}
