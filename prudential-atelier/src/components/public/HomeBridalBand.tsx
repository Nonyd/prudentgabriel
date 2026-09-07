import Link from "next/link";
import Image from "next/image";
import { GalleryCategory } from "@prisma/client";
import { cmsBool, cmsGet, getCMSContent } from "@/lib/cms";
import { prisma } from "@/lib/prisma";
import { isSkipDbBuild } from "@/lib/skip-db-build";
import { optimizeImageUrl } from "@/lib/utils";

const TAKE = 4;

export async function HomeBridalBand() {
  let images: { id: string; url: string; alt: string | null }[] = [];
  let cms: Record<string, string> = {};

  try {
    if (!isSkipDbBuild()) {
      const [rows, content] = await Promise.all([
        prisma.galleryImage.findMany({
          where: { isPublished: true, category: GalleryCategory.BRIDAL },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          take: TAKE,
          select: { id: true, url: true, alt: true },
        }),
        getCMSContent([
          "home_bridal_enabled",
          "home_bridal_headline",
          "home_bridal_subtext",
          "home_bridal_cta_label",
        ]),
      ]);
      images = rows;
      cms = content;
    }
  } catch {
    return null;
  }

  if (!cmsBool(cms, "home_bridal_enabled", true)) return null;
  if (images.length === 0) return null;

  const headline = cmsGet(cms, "home_bridal_headline", "Bridal");
  const subtext = cmsGet(cms, "home_bridal_subtext", "Gowns for the day itself.");
  const cta = cmsGet(cms, "home_bridal_cta_label", "See bridal");

  return (
    <section className="py-20">
      <div className="mx-auto mb-10 flex max-w-site flex-wrap items-end justify-between gap-4 px-6 lg:px-10">
        <div>
          <h2 className="font-display text-[42px] font-medium leading-tight text-choc">{headline}</h2>
          {subtext ? (
            <p className="mt-2 max-w-md font-body text-sm font-light text-text-mid">{subtext}</p>
          ) : null}
        </div>
        <Link href="/bridal" className="font-sans text-[13px] font-normal text-nut transition-opacity hover:opacity-80">
          {cta}
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-px bg-white md:grid-cols-4">
        {images.map((img) => (
          <Link key={img.id} href="/bridal" className="relative aspect-[3/4] overflow-hidden bg-ivory-dark">
            <Image
              src={optimizeImageUrl(img.url, 720)}
              alt={img.alt ?? headline}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
