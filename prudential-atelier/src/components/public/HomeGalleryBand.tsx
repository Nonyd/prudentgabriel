import Link from "next/link";
import Image from "next/image";
import { optimizeImageUrl } from "@/lib/utils";

export type BandImage = { id: string; url: string; alt: string | null };

/** The homepage strip of four pictures under a headline, shared by Bridal and Atelier. */
export function HomeGalleryBand({
  headline,
  subtext,
  cta,
  href,
  images,
}: {
  headline: string;
  subtext: string;
  cta: string;
  href: string;
  images: BandImage[];
}) {
  return (
    <section className="py-20">
      <div className="mx-auto mb-10 flex max-w-site flex-wrap items-end justify-between gap-4 px-6 lg:px-10">
        <div>
          <h2 className="font-display text-[42px] font-medium leading-tight text-choc">{headline}</h2>
          {subtext ? (
            <p className="mt-2 max-w-md font-body text-sm font-light text-text-mid">{subtext}</p>
          ) : null}
        </div>
        <Link href={href} className="font-sans text-[13px] font-normal text-nut transition-opacity hover:opacity-80">
          {cta}
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-px bg-white md:grid-cols-4">
        {images.map((img) => (
          <Link key={img.id} href={href} className="relative aspect-[3/4] overflow-hidden bg-ivory-dark">
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
