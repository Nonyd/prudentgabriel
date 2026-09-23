import { cmsGet } from "@/lib/cms-helpers";
import type { AtelierPiece } from "@/lib/atelier-gallery";
import { craftStages, processHeadline } from "@/lib/atelier-craft-stages";
import type { HeroCarouselItem } from "@/lib/hero-carousel";
import { AtelierScreening } from "@/components/atelier/AtelierScreening";
import { ATELIER_BEGIN_ID, AtelierPieceGrid } from "@/components/atelier/AtelierPieceGrid";
import { RTWLandingHero } from "@/components/rtw/RTWLandingHero";

type ReviewItem = {
  id: string;
  clientName: string;
  rating: number;
  title: string | null;
  body: string;
};

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
      {/* BB2.2: one photograph edge to edge; the copy on glass over it. */}
      <RTWLandingHero
        bleed
        items={heroItems}
        looks={fallbackLooks}
        headline={heroHeadline}
        subline={heroSubtext}
        ctaLabel={heroCta}
        ctaHref="/consultation"
      />

      {/* BB2.3: a pause between two blocks of photography. */}
      <section className="px-6 py-24 lg:px-10 lg:py-36" aria-labelledby="atelier-stages">
        <div className="mx-auto max-w-site">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="atelier-stages" className="font-display text-[clamp(2.25rem,4.5vw,3.5rem)] font-normal leading-tight text-choc">
              {headline}
            </h2>
            {processSubtext ? (
              <p className="mt-5 font-body text-[17px] leading-relaxed text-text-mid">{processSubtext}</p>
            ) : null}
          </div>
          <ol
            className="mt-16 grid list-none gap-x-16 gap-y-14 p-0 md:grid-cols-2 lg:mt-24 lg:grid-cols-3 lg:gap-y-20"
            data-atelier-stages={stages.length}
          >
            {stages.map((s, i) => (
              <li key={s.stage} className="border-t border-sand pt-6">
                <span className="font-body text-[12px] tabular-nums tracking-[0.18em] text-text-light">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 font-display text-[30px] font-normal leading-tight text-choc lg:text-[34px]">{s.label}</h3>
                {s.line ? (
                  <p className="mt-3 max-w-[36ch] font-body text-[16px] leading-[1.7] text-text-mid">{s.line}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* BB2.1: the photography holds the page — the shop's lookbook grid, edge to edge. */}
      {pieces.length > 0 ? (
        <section className="pt-20 lg:pt-28" aria-labelledby="atelier-pieces">
          <div className="mx-auto max-w-site px-6 pb-10 lg:px-10 lg:pb-14">
            <h2 id="atelier-pieces" className="font-display text-[clamp(2rem,4vw,3rem)] font-normal leading-tight text-choc">
              {galleryHeadline}
            </h2>
          </div>
          <AtelierPieceGrid pieces={pieces} />
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

      {/* BA4: the screening questions come first; the answers carry into the enquiry form. A gown in the grid leads here. */}
      <div id={ATELIER_BEGIN_ID} className="scroll-mt-24">
        <AtelierScreening headline={ctaHeadline} buttonLabel={ctaButton} />
      </div>
    </div>
  );
}
