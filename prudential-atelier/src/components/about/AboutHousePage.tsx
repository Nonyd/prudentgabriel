import Link from "next/link";
import { PFACrosslinkBannerClient } from "@/components/public/PFACrosslinkBannerClient";
import { GalleryFrame } from "@/components/gallery/GalleryFrame";
import { houseCtaLabel, type AboutLook, type AboutStat } from "@/lib/about-house";
import type { AboutValue } from "@/lib/page-content-defaults";
import { readyToWearCtaHref } from "@/lib/rtw-aisle";
import { cn } from "@/lib/utils";

export type AboutAtelier = {
  name: string;
  address: string;
  hours: string;
  maps: string;
};

/**
 * The house's own book. Photographs are shown whole, at the portrait shape they
 * were taken in; text is set as reading columns; one moment is large: the
 * founder's line across her band.
 *
 * The founder band is dark in both themes on purpose, so it uses fixed colours
 * (FOUNDER_*), not the theme tokens: in dark mode `choc` turns pale and `cream`
 * near-white, which made her biography unreadable on the old band.
 */
const FOUNDER_BG = "#2b190c";
const FOUNDER_TEXT = "#f3e9de";
const FOUNDER_MUTED = "#cdb6a2";
const FOUNDER_RULE = "rgb(201 168 76 / 0.45)";

export function AboutHousePage({
  headline,
  subtext,
  looks,
  storyHeadline,
  storyParagraphs,
  storyImage,
  founderName,
  founderTitle,
  founderImage,
  founderBios,
  founderQuote,
  stats,
  valuesHeadline,
  values,
  atelierHeadline,
  atelier,
  atelierLook,
  showAcademy,
  academyHeadline,
  academyBody,
  academyCtaLabel,
  academyCtaLink,
  ctaHeadline,
  ctaQuote,
  ctaPrimaryLabel,
  ctaPrimaryHref,
  ctaSecondaryLabel,
  ctaSecondaryHref,
}: {
  headline: string;
  subtext: string;
  looks: AboutLook[];
  storyHeadline: string;
  storyParagraphs: string[];
  storyImage: string;
  founderName: string;
  founderTitle: string;
  founderImage: string;
  founderBios: string[];
  founderQuote: string;
  stats: AboutStat[];
  valuesHeadline: string;
  values: AboutValue[];
  atelierHeadline: string;
  atelier: AboutAtelier;
  atelierLook?: AboutLook;
  showAcademy: boolean;
  academyHeadline: string;
  academyBody: string;
  academyCtaLabel: string;
  academyCtaLink: string;
  ctaHeadline: string;
  ctaQuote: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
}) {
  const featured = looks[0] ?? { url: storyImage, alt: "Prudential Atelier" };
  const houseLook = atelierLook ?? featured;
  const sideLooks = looks.slice(1, 3);
  const hasSides = sideLooks.length > 0;
  const storyBody = storyParagraphs.filter(Boolean);
  const [storyLead, ...storyRest] = storyBody;
  const bios = founderBios.filter(Boolean);

  return (
    <div className="min-h-screen bg-bg-card">
      {/* Hero: the house standard (full bleed, copy on glass), as on /atelier and /rtw. */}
      <section className="hero-under-chrome hero-bleed-chrome relative flex min-h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-choc">
        <div className="relative min-h-0 flex-1 pt-3 max-lg:absolute max-lg:inset-0 max-lg:pt-0">
          <div
            className={cn(
              "absolute inset-0 min-h-0",
              hasSides &&
                "lg:left-[40%] lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.85fr)] lg:grid-rows-2 lg:gap-4 lg:p-5 lg:pr-8",
            )}
          >
            <div className={cn("relative h-full min-h-0", hasSides && "lg:row-span-2")}>
              <div className="absolute inset-0 overflow-hidden rounded-none lg:rounded-[26px]">
                <GalleryFrame url={featured.url} alt={featured.alt} width={1400} fill />
              </div>
            </div>
            {sideLooks.map((look) => (
              <div key={look.url} className="relative hidden min-h-0 overflow-hidden rounded-[26px] lg:block">
                <GalleryFrame url={look.url} alt={look.alt} width={900} fill />
              </div>
            ))}
          </div>

          <div
            className="pointer-events-none absolute inset-0 z-[1] lg:hidden"
            style={{
              background:
                "linear-gradient(to top, rgb(26 15 8 / 0.62) 0%, rgb(26 15 8 / 0.18) 46%, transparent 72%)",
            }}
            aria-hidden
          />

          <div className="absolute inset-x-0 bottom-0 z-[2] flex items-end px-5 pb-10 md:px-10 md:pb-14 lg:inset-y-0 lg:right-auto lg:w-[40%] lg:items-center lg:px-10 lg:pb-0">
            <div className="relative w-full max-w-md lg:max-w-[26rem]">
              <div className="hero-copy-scrim" aria-hidden />
              <div className="glass-1 glass-panel hero-copy-panel px-6 py-8 md:px-8 md:py-10">
                <h1 className="text-balance pb-1 font-display text-[clamp(2.15rem,4.2vw,3.75rem)] font-normal italic leading-[1.12] text-choc">
                  {headline}
                </h1>
                <p className="mt-5 max-w-sm font-body text-sm font-light leading-relaxed text-text-mid">{subtext}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href={ctaPrimaryHref} className="btn-primary inline-flex active:scale-[0.97]">
                    {houseCtaLabel(ctaPrimaryLabel)}
                  </Link>
                  <a href="#atelier" className="btn-ghost-light inline-flex active:scale-[0.97]">
                    Visit the atelier
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The story: the photograph whole, beside the words. */}
      <section className="mx-auto max-w-site px-6 py-20 lg:px-10 lg:py-32">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
          <figure className="relative mx-auto w-full max-w-[34rem] lg:sticky lg:top-[calc(var(--storefront-chrome-offset,5rem)+2rem)]">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-ivory-dark">
              <GalleryFrame url={storyImage} alt="A gown from the Lagos atelier" width={1100} fill />
            </div>
          </figure>
          <div className="lg:pt-10">
            <h2 className="max-w-[14ch] text-balance pb-2 font-display text-[clamp(2.6rem,5.4vw,4.75rem)] font-normal italic leading-[1.02] text-choc">
              {storyHeadline}
            </h2>
            {storyLead ? (
              <p className="mt-10 max-w-[34rem] font-display text-[clamp(1.35rem,2vw,1.65rem)] font-normal leading-[1.45] text-choc">
                {storyLead}
              </p>
            ) : null}
            {storyRest.length > 0 ? (
              <div className="mt-8 max-w-[34rem] space-y-6 border-l border-sand pl-6 font-body text-[15px] font-light leading-[1.95] text-text-mid">
                {storyRest.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* The founder: dark in both themes, and her line set large across it. */}
      <section style={{ backgroundColor: FOUNDER_BG, color: FOUNDER_TEXT }} className="relative overflow-hidden">
        <div className="mx-auto max-w-site px-6 pt-20 lg:px-10 lg:pt-28">
          <div className="grid items-end gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-[30rem] overflow-hidden rounded-[22px] lg:mx-0">
              <GalleryFrame url={founderImage} alt={founderName} width={1000} fill />
            </div>
            <div className="pb-2">
              <h2 className="text-balance pb-1 font-display text-[clamp(2.2rem,4.4vw,3.6rem)] font-normal italic leading-[1.08]">
                {founderName}
              </h2>
              <p className="mt-3 font-sans text-[13px] tracking-[0.06em]" style={{ color: FOUNDER_MUTED }}>
                {founderTitle}
              </p>
              {bios.length > 0 ? (
                <div
                  className="mt-10 max-w-[36rem] space-y-5 font-body text-[15px] font-light leading-[1.95]"
                  style={{ color: FOUNDER_TEXT }}
                >
                  {bios.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {founderQuote ? (
          <figure className="mx-auto max-w-site px-6 pb-20 pt-16 lg:px-10 lg:pb-28 lg:pt-24">
            <div className="h-px w-24" style={{ backgroundColor: FOUNDER_RULE }} aria-hidden />
            <blockquote className="mt-10 max-w-[22ch] text-balance pb-2 font-display text-[clamp(2.4rem,6.2vw,5.5rem)] font-light italic leading-[1.04]">
              &ldquo;{founderQuote}&rdquo;
            </blockquote>
            <figcaption className="mt-8 font-sans text-[13px] tracking-[0.06em]" style={{ color: FOUNDER_MUTED }}>
              {founderName}
            </figcaption>
          </figure>
        ) : null}
      </section>

      {/* The principles: a house glossary. The heading stays while the six pass. */}
      {values.length > 0 ? (
        <section className="mx-auto max-w-site px-6 py-20 lg:px-10 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-20">
            <h2 className="max-w-[12ch] text-balance pb-1 font-display text-[clamp(2.2rem,4vw,3.4rem)] font-normal italic leading-[1.06] text-choc lg:sticky lg:top-[calc(var(--storefront-chrome-offset,5rem)+2rem)] lg:self-start">
              {valuesHeadline}
            </h2>
            <dl className="divide-y divide-sand border-y border-sand">
              {values.map((value) => (
                <div key={value.name} className="grid gap-2 py-7 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-10 md:py-9">
                  <dt className="font-display text-[1.65rem] font-normal italic leading-[1.15] text-choc md:text-[1.9rem]">
                    {value.name}
                  </dt>
                  <dd className="max-w-[30rem] font-body text-[15px] font-light leading-[1.85] text-text-mid md:pt-1.5">
                    {value.description}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      ) : null}

      {/* The Lagos atelier: a visiting card beside the photograph, the figures beneath. */}
      <section
        id="atelier"
        className="scroll-mt-[calc(var(--storefront-chrome-offset)+1.5rem)] bg-ivory px-6 py-20 lg:px-10 lg:py-28"
      >
        <article data-about-atelier className="mx-auto grid max-w-site items-center gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-20">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[22px] bg-ivory-dark md:aspect-[5/4] lg:aspect-[4/5]">
            <GalleryFrame url={houseLook.url} alt={houseLook.alt} width={1300} fill />
          </div>
          <div>
            <h2 className="text-balance pb-1 font-display text-[clamp(2.2rem,4vw,3.4rem)] font-normal italic leading-[1.06] text-choc">
              {atelierHeadline}
            </h2>
            <address className="mt-8 whitespace-pre-line font-body text-[15px] font-light not-italic leading-[1.85] text-text-mid">
              {atelier.address}
            </address>
            {atelier.hours ? (
              <p className="mt-4 font-sans text-[13px] tracking-[0.03em] text-text-light">{atelier.hours}</p>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={atelier.maps} target="_blank" rel="noopener noreferrer" className="btn-ghost-light inline-flex">
                Get directions
              </a>
              <Link href={ctaPrimaryHref} className="btn-primary inline-flex">
                {houseCtaLabel(ctaPrimaryLabel)}
              </Link>
            </div>
            {stats.length > 0 ? (
              <dl className="mt-14 grid grid-cols-2 gap-x-8 gap-y-8 border-t border-sand pt-10">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="sr-only">{stat.label}</dt>
                    <dd>
                      <span className="block font-display text-[2.4rem] leading-none text-choc md:text-[2.8rem]">
                        {stat.number}
                      </span>
                      <span className="mt-2 block font-sans text-[13px] tracking-[0.03em] text-text-mid" aria-hidden>
                        {stat.label}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </article>
      </section>

      {showAcademy ? (
        <section id="academy">
          <PFACrosslinkBannerClient
            cms={{
              home_pfa_headline: academyHeadline,
              home_pfa_body: academyBody,
              home_pfa_button_label: academyCtaLabel,
              home_pfa_button_link: academyCtaLink,
            }}
          />
        </section>
      ) : null}

      {/* The invitation: the page ends where every commission begins. */}
      <section className="mx-auto max-w-site px-6 py-24 lg:px-10 lg:py-36">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-20">
          <div>
            <h2 className="max-w-[16ch] text-balance pb-2 font-display text-[clamp(2.6rem,5.6vw,5rem)] font-normal italic leading-[1.02] text-choc">
              {ctaHeadline}
            </h2>
            {ctaQuote ? (
              <p className="mt-6 max-w-[30rem] font-body text-[15px] font-light leading-[1.85] text-text-mid">{ctaQuote}</p>
            ) : null}
          </div>
          <div className="lg:pb-3">
            <div className="flex flex-wrap gap-3">
              <Link href={ctaPrimaryHref} className="btn-primary">
                {houseCtaLabel(ctaPrimaryLabel)}
              </Link>
              <Link href={readyToWearCtaHref(ctaSecondaryHref)} className="btn-ghost-light">
                {houseCtaLabel(ctaSecondaryLabel)}
              </Link>
            </div>
            <p className="mt-8 font-body text-sm font-light text-text-mid">
              Interested in joining the house?{" "}
              <Link href="/careers" className="underline underline-offset-4 hover:text-choc">
                View open positions
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
