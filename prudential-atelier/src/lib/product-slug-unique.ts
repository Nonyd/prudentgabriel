import slugify from "slugify";
import type { PrismaClient } from "@prisma/client";

type SlugDb = Pick<PrismaClient, "product"> | { product: PrismaClient["product"] };

export function slugStemFromName(name: string): string {
  const s = slugify(name, { lower: true, strict: true }).slice(0, 80);
  return s.length >= 1 ? s : "piece";
}

export async function allocateProductSlug(
  db: SlugDb,
  opts: { name: string; requested?: string | null; excludeId?: string },
): Promise<string> {
  const requested = (opts.requested ?? "").trim();
  const stem =
    requested && /^[a-z0-9-]+$/.test(requested) ? requested.slice(0, 80) : slugStemFromName(opts.name);
  let candidate = stem;
  let n = 2;
  for (;;) {
    const taken = await db.product.findFirst({
      where: {
        slug: candidate,
        ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!taken) return candidate;
    candidate = `${stem}-${n++}`;
  }
}
