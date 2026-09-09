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
  const bios = founderBios.filter(Boolean);

  return (
    <div className="min-h-screen bg-bg-card">
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

      <section className="mx-auto max-w-site px-6 py-16 lg:px-10 lg:py-24">
        <div className="relative overflow-hidden rounded-[26px] bg-ivory-dark">
          <div className="relative aspect-[4/5] min-h-[28rem] md:aspect-[16/10] md:min-h-[32rem]">
            <GalleryFrame url={storyImage} alt="The Lagos atelier" width={1600} fill />
          </div>
          <div className="absolute inset-x-0 bottom-0 p-5 md:inset-y-0 md:right-auto md:flex md:w-[min(28rem,46%)] md:items-end md:p-8">
            <div className="glass-1 glass-panel w-full px-6 py-7 md:px-8 md:py-9">
              <h2 className="pb-1 font-display text-[clamp(1.75rem,3vw,2.75rem)] font-normal italic leading-[1.12] text-choc">
                {storyHeadline}
              </h2>
              {storyBody[0] ? (
                <p className="mt-5 font-body text-sm font-light leading-[1.85] text-text-mid">{storyBody[0]}</p>
              ) : null}
            </div>
          </div>
        </div>
        {storyBody.length > 1 ? (
          <div className="mx-auto mt-12 max-w-[38rem] space-y-5 font-body text-[15px] font-light leading-[1.9] text-text-mid lg:ml-[8%]">
            {storyBody.slice(1).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="bg-choc px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto grid max-w-site items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-[26px] bg-nut/20 lg:mx-0">
            <GalleryFrame url={founderImage} alt={founderName} width={900} fill />
          </div>
          <div>
            <h2 className="pb-1 font-display text-[clamp(2rem,4vw,3.25rem)] font-normal italic leading-[1.12] text-cream">
              {founderName}
            </h2>
            <p className="mt-2 font-body text-[13px] font-light tracking-[0.04em] text-lightbr">{founderTitle}</p>
            <div className="mt-8 max-w-[40rem] space-y-5 font-body text-[15px] font-light leading-[1.9] text-cream/80">
              {bios.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            {founderQuote ? (
              <blockquote className="mt-10 max-w-[28rem] pb-1 font-display text-[1.5rem] font-normal italic leading-[1.35] text-cream md:text-[1.75rem]">
                {founderQuote}
              </blockquote>
            ) : null}
          </div>
        </div>
      </section>

      {values.length > 0 ? (
        <section className="px-6 py-20 lg:px-10 lg:py-28">
          <div className="mx-auto max-w-site">
            <h2 className="max-w-[20rem] pb-1 font-display text-[clamp(1.85rem,3.2vw,2.75rem)] font-normal italic leading-[1.12] text-choc">
              {valuesHeadline}
            </h2>
            <ul className="mt-14 grid gap-x-16 gap-y-12 md:grid-cols-2">
              {values.map((value) => (
                <li key={value.name} className="max-w-[28rem] border-t border-sand/80 pt-6">
                  <h3 className="font-display text-[1.375rem] font-normal italic leading-[1.2] text-choc">{value.name}</h3>
                  <p className="mt-3 font-body text-sm font-light leading-[1.85] text-text-mid">{value.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section id="atelier" className="scroll-mt-[calc(var(--storefront-chrome-offset)+1.5rem)] px-6 pb-20 lg:px-10 lg:pb-28">
        <div className="mx-auto max-w-site">
          <h2 className="pb-1 font-display text-[clamp(1.85rem,3.2vw,2.75rem)] font-normal italic leading-[1.12] text-choc">
            {atelierHeadline}
          </h2>
          {stats.length > 0 ? (
            <div className="mt-10 flex flex-wrap gap-10">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <p className="font-display text-[2.25rem] leading-none text-choc md:text-[2.75rem]">{stat.number}</p>
                  <p className="mt-2 font-body text-[11px] uppercase tracking-[0.16em] text-text-light">{stat.label}</p>
                </div>
              ))}
            </div>
          ) : null}

          <article
            data-about-atelier
            className="relative mt-12 overflow-hidden rounded-[26px] bg-ivory-dark"
          >
            <div className="relative aspect-[4/5] min-h-[22rem] md:aspect-[16/9] md:min-h-[28rem]">
              <GalleryFrame url={houseLook.url} alt={houseLook.alt} width={1600} fill />
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: "linear-gradient(to top, rgb(26 15 8 / 0.45) 0%, transparent 55%)",
                }}
                aria-hidden
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 p-5 md:inset-y-auto md:left-8 md:right-auto md:bottom-8 md:w-[min(22rem,90%)]">
              <div className="glass-1 glass-panel px-6 py-7">
                <p className="font-display text-[1.5rem] italic leading-[1.15] text-choc">{atelier.name}</p>
                <p className="mt-3 whitespace-pre-line font-body text-sm font-light leading-relaxed text-text-mid">
                  {atelier.address}
                </p>
                {atelier.hours ? (
                  <p className="mt-3 font-body text-[13px] font-light text-text-light">{atelier.hours}</p>
                ) : null}
                <a
                  href={atelier.maps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost-light mt-6 inline-flex"
                >
                  Get directions
                </a>
              </div>
            </div>
          </article>
        </div>
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

      <section className="px-6 py-20 lg:px-10 lg:py-28">
        <div className="glass-1 glass-panel mx-auto max-w-xl px-8 py-12 text-center md:px-12 md:py-14">
          <h2 className="pb-1 font-display text-[clamp(1.75rem,3vw,2.5rem)] font-normal italic leading-[1.12] text-choc">
            {ctaHeadline}
          </h2>
          {ctaQuote ? (
            <p className="mx-auto mt-4 max-w-md font-body text-sm font-light italic leading-relaxed text-text-mid">
              {ctaQuote}
            </p>
          ) : null}
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href={ctaPrimaryHref} className="btn-primary">
              {houseCtaLabel(ctaPrimaryLabel)}
            </Link>
            <Link href={readyToWearCtaHref(ctaSecondaryHref)} className="btn-ghost-light">
              {houseCtaLabel(ctaSecondaryLabel)}
            </Link>
          </div>
          <p className="mt-8 font-body text-sm font-light text-text-mid">
            Interested in joining the house?{" "}
            <Link href="/careers" className="underline underline-offset-2 hover:text-choc">
              View open positions
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
