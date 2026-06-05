import Image from "next/image";
import Link from "next/link";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/bespoke-stages";
import { optimizeImageUrl } from "@/lib/utils";
import { cmsGet } from "@/lib/cms-helpers";

type GalleryImage = {
  id: string;
  url: string;
  alt: string | null;
  caption: string | null;
};

type ReviewItem = {
  id: string;
  clientName: string;
  rating: number;
  title: string | null;
  body: string;
};

export function AtelierLandingPage({
  galleryImages,
  reviews,
  cms = {},
}: {
  galleryImages: GalleryImage[];
  reviews: ReviewItem[];
  cms?: Record<string, string>;
}) {
  const stages = STAGE_ORDER.map((s) => STAGE_LABELS[s]);
  const heroHeadline = cmsGet(cms, "atelier_hero_headline", "The Atelier");
  const heroSubtext = cmsGet(
    cms,
    "atelier_hero_subtext",
    "Every commission begins with a conversation. We design entirely around you.",
  );
  const heroCta = cmsGet(cms, "atelier_hero_cta_label", "Begin a Commission");
  const processHeadline = cmsGet(cms, "atelier_process_headline", "Thirteen stages of craft");
  const processSubtext = cmsGet(
    cms,
    "atelier_process_subtext",
    "From consultation to delivery — every step documented and shared with you.",
  );
  const galleryLabel = cmsGet(cms, "atelier_gallery_label", "Past Work");
  const galleryHeadline = cmsGet(cms, "atelier_gallery_headline", "From our atelier");
  const ctaHeadline = cmsGet(cms, "atelier_cta_headline", "Ready to begin?");
  const ctaButton = cmsGet(cms, "atelier_cta_button_label", "Book your consultation");

  return (
    <div>
      <section className="bg-choc px-6 py-24 text-center lg:px-10 lg:py-32">
        <h1
          className="leading-tight"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.5rem, 6vw, 64px)",
            color: "var(--cream)",
            fontWeight: 400,
          }}
        >
          {heroHeadline}
        </h1>
        <p
          className="mx-auto mt-6 max-w-xl"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "16px",
            color: "var(--sand)",
            lineHeight: 1.7,
          }}
        >
          {heroSubtext}
        </p>
        <Link
          href="/consultation"
          className="mt-10 inline-block px-10 py-4 uppercase transition-opacity hover:opacity-90"
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.18em",
            backgroundColor: "var(--cream)",
            color: "var(--choc)",
          }}
        >
          {heroCta}
        </Link>
      </section>

      <section className="bg-ivory px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-site">
          <p
            className="text-center uppercase"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "10px",
              letterSpacing: "0.2em",
              color: "var(--lightbr)",
            }}
          >
            The Process
          </p>
          <h2
            className="mt-3 text-center"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "36px",
              color: "var(--choc)",
            }}
          >
            {processHeadline}
          </h2>
          {processSubtext ? (
            <p
              className="mx-auto mt-4 max-w-xl text-center"
              style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "var(--text-mid)" }}
            >
              {processSubtext}
            </p>
          ) : null}
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stages.map((label) => (
              <div
                key={label}
                className="border border-sand/60 bg-cream/30 px-5 py-4"
                style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-mid)" }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {galleryImages.length > 0 ? (
        <section className="bg-cream px-6 py-20 lg:px-10">
          <div className="mx-auto max-w-site">
            <p
              className="uppercase"
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "10px",
                letterSpacing: "0.2em",
                color: "var(--lightbr)",
              }}
            >
              {galleryLabel}
            </p>
            <h2
              className="mt-3"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "32px",
                color: "var(--choc)",
              }}
            >
              {galleryHeadline}
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {galleryImages.slice(0, 8).map((img) => (
                <div key={img.id} className="relative aspect-[3/4] overflow-hidden bg-sand/20">
                  <Image
                    src={optimizeImageUrl(img.url, 600)}
                    alt={img.alt || img.caption || "Atelier work"}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {reviews.length > 0 ? (
        <section className="bg-ivory px-6 py-20 lg:px-10">
          <div className="mx-auto max-w-site">
            <h2
              className="text-center"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "32px",
                color: "var(--choc)",
              }}
            >
              Client words
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {reviews.slice(0, 3).map((r) => (
                <blockquote
                  key={r.id}
                  className="border border-sand/60 bg-cream/20 p-6"
                  style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "var(--text-mid)" }}
                >
                  <p className="italic">&ldquo;{r.body}&rdquo;</p>
                  <footer className="mt-4 text-[12px] text-lightbr">
                    — {r.clientName}
                    {r.title ? `, ${r.title}` : ""}
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-choc px-6 py-16 text-center lg:px-10">
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "28px",
            color: "var(--cream)",
          }}
        >
          {ctaHeadline}
        </p>
        <Link
          href="/consultation"
          className="mt-6 inline-block border border-cream/40 px-8 py-3 uppercase transition-colors hover:bg-cream/10"
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.16em",
            color: "var(--cream)",
          }}
        >
          {ctaButton}
        </Link>
      </section>
    </div>
  );
}
