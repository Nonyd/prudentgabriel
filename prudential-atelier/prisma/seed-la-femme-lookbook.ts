import type { PrismaClient } from "@prisma/client";
import { PrismaClient as PrismaClientCtor } from "@prisma/client";

const LA_FEMME_SLUGS = [
  "alouette-set",
  "avril",
  "elise",
  "celine-jumpsuit",
  "lisette",
  "julia",
  "esme-dress",
  "amelie-jumpsuit",
  "vivienne-2-piece",
  "nadine-2-piece",
  "mireille-2-piece",
  "yvette-dress",
] as const;

const REEL_VIDEOS = [
  "https://res.cloudinary.com/dwgbr0oyn/video/upload/f_mp4,q_auto,vc_h264/v1780735520/prudent-gabriel/hero-videos/heqzlewdwvxploal84ll.mp4",
  "https://res.cloudinary.com/dwgbr0oyn/video/upload/f_mp4,q_auto,vc_h264/v1780763264/prudent-gabriel/hero-videos/jgbxiw7gav1ogrs5jela.mp4",
] as const;

function isHouseProduct(name: string, slug: string) {
  const n = name.toLowerCase();
  const s = slug.toLowerCase();
  if (n.startsWith("ac ") || s.startsWith("ac-")) return false;
  if (n.includes("slice r") || s.includes("slice-r")) return false;
  if (n.startsWith("z1 ") || s.startsWith("z1-")) return false;
  if (n.startsWith("aa ") || s.startsWith("aa-")) return false;
  if (n.includes("stock launch")) return false;
  return true;
}

/** Seed one live collection so AE1/AE2 can be judged. Staging-only lookbook. */
export async function ensureLaFemmeLookbook(prisma: PrismaClient) {
  const named = await prisma.product.findMany({
    where: { slug: { in: [...LA_FEMME_SLUGS] }, isPublished: true },
    select: {
      id: true,
      slug: true,
      name: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
    },
  });
  const bySlug = new Map(named.map((p) => [p.slug, p]));
  let picked = LA_FEMME_SLUGS.map((slug) => bySlug.get(slug)).filter(
    (p): p is (typeof named)[number] => Boolean(p),
  );

  if (picked.length < 12) {
    const extra = await prisma.product.findMany({
      where: { isPublished: true, id: { notIn: picked.map((p) => p.id) } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        slug: true,
        name: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      },
    });
    for (const p of extra) {
      if (picked.length >= 12) break;
      if (!isHouseProduct(p.name, p.slug)) continue;
      picked.push(p);
    }
  }

  picked = picked.slice(0, 12);
  if (picked.length === 0) return { collectionId: null as string | null, productCount: 0 };

  const cover = picked.find((p) => p.images[0]?.url)?.images[0]?.url ?? null;

  const collection = await prisma.collection.upsert({
    where: { slug: "la-femme" },
    update: {
      name: "La Femme",
      excerpt: "For the woman who defines her own standard.",
      description:
        "La Femme is our most editorial collection — dramatic cuts, unexpected fabrics, and a silhouette that turns every room into a runway.",
      isPublished: true,
      isFeatured: true,
      displayOrder: 0,
      season: "Spring/Summer 2026",
      autoTag: null,
      ...(cover ? { coverImage: cover, coverImageAlt: "La Femme" } : {}),
    },
    create: {
      name: "La Femme",
      slug: "la-femme",
      excerpt: "For the woman who defines her own standard.",
      description:
        "La Femme is our most editorial collection — dramatic cuts, unexpected fabrics, and a silhouette that turns every room into a runway.",
      isPublished: true,
      isFeatured: true,
      displayOrder: 0,
      season: "Spring/Summer 2026",
      autoTag: null,
      coverImage: cover,
      coverImageAlt: "La Femme",
    },
  });

  await prisma.collectionProduct.deleteMany({ where: { collectionId: collection.id } });
  await prisma.collectionProduct.createMany({
    data: picked.map((p, i) => ({
      collectionId: collection.id,
      productId: p.id,
      sortOrder: i,
    })),
  });

  await prisma.collection.updateMany({
    where: {
      slug: { in: ["rich-regal", "church-girl", "soft-shift", "rich-and-regal"] },
    },
    data: { isPublished: false, isFeatured: false },
  });

  const existingReels = await prisma.collectionReel.count({ where: { collectionId: collection.id } });
  if (existingReels === 0) {
    const posters = picked.map((p) => p.images[0]?.url).filter((u): u is string => Boolean(u));
    if (posters.length >= 2) {
      await prisma.collectionReel.createMany({
        data: [
          {
            collectionId: collection.id,
            videoKey: REEL_VIDEOS[0],
            posterKey: posters[0]!,
            position: 3,
            productId: picked[2]?.id ?? null,
            sortOrder: 0,
            isActive: true,
          },
          {
            collectionId: collection.id,
            videoKey: REEL_VIDEOS[1],
            posterKey: posters[1]!,
            position: 8,
            productId: picked[7]?.id ?? null,
            sortOrder: 1,
            isActive: true,
          },
        ],
      });
    }
  }

  return { collectionId: collection.id, productCount: picked.length };
}

if (process.argv[1] && /seed-la-femme-lookbook/.test(process.argv[1])) {
  const prisma = new PrismaClientCtor();
  ensureLaFemmeLookbook(prisma)
    .then((r) => {
      console.log("La Femme lookbook", r);
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
