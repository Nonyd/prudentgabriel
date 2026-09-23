import Image from "next/image";
import { cmsGet } from "@/lib/cms-helpers";
import { cn, optimizeImageUrl } from "@/lib/utils";
import { priceGuideText } from "@/lib/price-guide";
import type { AtelierPiece } from "@/lib/atelier-gallery";
import { craftStages, processHeadline } from "@/lib/atelier-craft-stages";
import type { HeroCarouselItem } from "@/lib/hero-carousel";
import { PriceGuideLine } from "@/components/gallery/PriceGuideLine";
import { AtelierScreening } from "@/components/atelier/AtelierScreening";
import { RTWLandingHero } from "@/components/rtw/RTWLandingHero";

type ReviewItem = {
  id: string;
  clientName: string;
  rating: number;
  title: string | null;
  body: string;
};

/** BB3: a piece's photographs. One is a single frame; several scroll on a phone and sit as a set on a wide screen. */
function PieceFrames({ piece, className }: { piece: AtelierPiece; className?: string }) {
  const { frames } = piece;
  if (frames.length === 1) {
    const frame = frames[0]!;
    return (
      <div className={cn("relative aspect-[4/5] overflow-hidden bg-sand/20", className)}>
        <Image
          src={optimizeImageUrl(frame.url, 1200)}
          alt={frame.alt}
          fill
          className="object-cover object-top"
          sizes="(min-width: 1024px) 40vw, 100vw"
        />
      </div>
    );
  }
  const leadSpans = frames.length % 2 === 1;
  return (
    <div className={className}>
      <div className="-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0">
        {frames.map((frame, i) => (
          <div
            key={frame.id}
            className={cn(
              "relative aspect-[4/5] w-[82%] shrink-0 snap-start overflow-hidden bg-sand/20 lg:w-auto",
              i === 0 && leadSpans && "lg:col-span-2",
            )}
          >
            <Image
              src={optimizeImageUrl(frame.url, 1200)}
              alt={frame.alt}
              fill
              className="object-cover object-top"
              sizes={i === 0 && leadSpans ? "(min-width: 1024px) 40vw, 82vw" : "(min-width: 1024px) 20vw, 82vw"}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 font-body text-[11px] uppercase tracking-[0.14em] text-text-light lg:hidden">
        {frames.length} photographs of this piece
      </p>
    </div>
  );
}

/**
 * One piece, one entry, its words beside it. A piece with nothing written yet is
 * shown plainly — the photographs alone, no empty caption.
 */
export function AtelierPieceEntry({ piece, flip = false }: { piece: AtelierPiece; flip?: boolean }) {
  const hasGuide = priceGuideText(piece.guide) !== null;
  const hasWords = Boolean(piece.title || piece.description || hasGuide);

  if (!hasWords) {
    return (
      <article data-atelier-piece={piece.id} className="mx-auto w-full max-w-xl">
        <PieceFrames piece={piece} />
      </article>
    );
  }

  return (
    <article
      data-atelier-piece={piece.id}
      className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-14"
    >
      <PieceFrames piece={piece} className={flip ? "lg:order-2" : undefined} />
      <div className={cn("max-w-md", flip && "lg:order-1 lg:justify-self-end")}>
        {piece.title ? (
          <h3 className="font-display text-[28px] font-normal leading-tight text-choc">{piece.title}</h3>
        ) : null}
        {piece.description ? (
          <p
            className={cn("whitespace-pre-line font-body text-[15px] leading-relaxed text-text-mid", piece.title && "mt-4")}
          >
            {piece.description}
          </p>
        ) : null}
        {hasGuide ? (
          <PriceGuideLine guide={piece.guide} emphasis className={piece.title || piece.description ? "mt-6" : undefined} />
        ) : null}
      </div>
    </article>
  );
}

export function AtelierLandingPage({
  heroItems,
  pieces,
  reviews,
  cms = {},
}: {
  heroItems: HeroCarouselItem[];
  pieces: AtelierPiece[];
  reviews: ReviewItem[];
  cms?: Record<string, string>;
}) {
  const stages = craftStages(cms);
  const heroHeadline = cmsGet(cms, "atelier_hero_headline", "The Atelier");
  const heroSubtext = cmsGet(
    cms,
    "atelier_hero_subtext",
    "Every commission begins with a conversation. We design entirely around you.",
  );
  const heroCta = cmsGet(cms, "atelier_hero_cta_label", "Begin a Commission");
  const headline = processHeadline(cms.atelier_process_headline, stages.length);
  const processSubtext = cmsGet(
    cms,
    "atelier_process_subtext",
    "After the consultation, the making begins. Every stage is documented and shared with you.",
  );
  const galleryHeadline = cmsGet(cms, "atelier_gallery_headline", "From our atelier");
  const ctaHeadline = cmsGet(cms, "atelier_cta_headline", "Ready to begin?");
  const ctaButton = cmsGet(cms, "atelier_cta_button_label", "Book your consultation");

  // Until the house sets a photograph or film, the hero shows the first piece in
  // its own gallery — the house's photography, never stock.
  const lead = pieces[0]?.frames[0];
  const fallbackLooks = heroItems.length === 0 && lead ? [{ url: lead.url, alt: lead.alt }] : [];

  return (
    <div>
      <RTWLandingHero
        items={heroItems}
        looks={fallbackLooks}
        headline={heroHeadline}
        subline={heroSubtext}
        ctaLabel={heroCta}
        ctaHref="/consultation"
      />

      <section className="px-6 py-20 lg:px-10 lg:py-28" aria-labelledby="atelier-stages">
        <div className="mx-auto max-w-site">
          <h2 id="atelier-stages" className="text-center font-display text-[36px] font-normal text-choc">
            {headline}
          </h2>
          {processSubtext ? (
            <p className="mx-auto mt-4 max-w-xl text-center font-body text-sm text-text-mid">{processSubtext}</p>
          ) : null}
          <ol className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3" data-atelier-stages={stages.length}>
            {stages.map((s, i) => (
              <li key={s.stage} className="glass-2 glass-panel px-6 py-5">
                <span className="font-body text-[11px] tabular-nums tracking-[0.14em] text-text-light">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-1 font-display text-[22px] font-normal leading-snug text-choc">{s.label}</h3>
                {s.line ? <p className="mt-2 font-body text-[13px] leading-relaxed text-text-mid">{s.line}</p> : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {pieces.length > 0 ? (
        <section className="px-6 py-20 lg:px-10" aria-labelledby="atelier-pieces">
          <div className="mx-auto max-w-site">
            <h2 id="atelier-pieces" className="font-display text-[32px] font-normal text-choc">
              {galleryHeadline}
            </h2>
            <div className="mt-12 space-y-16 lg:space-y-24">
              {pieces.map((piece, i) => (
                <AtelierPieceEntry key={piece.id} piece={piece} flip={i % 2 === 1} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {reviews.length > 0 ? (
        <section className="px-6 py-20 lg:px-10">
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
                  className="glass-2 glass-panel p-6"
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

      {/* BA4: the screening questions come first; the answers carry into the enquiry form. */}
      <AtelierScreening headline={ctaHeadline} buttonLabel={ctaButton} />
    </div>
  );
}
