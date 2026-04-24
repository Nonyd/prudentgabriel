import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { PFABanner } from "@/components/common/PFABanner";
import { cn } from "@/lib/utils";

export const revalidate = 86400;

const PRESS_ITEMS = [
  {
    publication: "Vanguard Allure",
    headline: "Prudent Gabriel: Legacy Beyond Fashion",
    excerpt:
      "From a tiny room in Ajah to dressing celebrities across four continents — the story of one of Nigeria's most celebrated fashion entrepreneurs.",
    date: "September 2024",
    url: "https://allure.vanguardngr.com",
  },
  {
    publication: "Guardian Life",
    headline: "The Designer Putting Nigerian Bridal Fashion on the Global Map",
    excerpt:
      "Prudential Atelier's signature blend of French lace and West African silhouettes has captured the attention of brides from Lagos to London.",
    date: "August 2024",
    url: "#",
  },
  {
    publication: "Bella Naija Style",
    headline: "AMVCA 2024: Our Favourite Traditional Day Looks",
    excerpt:
      "Liquor Rose's jaw-dropping emerald aso-oke creation from Prudential Atelier was undeniably the standout of the AMVCA trad day red carpet.",
    date: "July 2024",
    url: "#",
  },
  {
    publication: "ThisDay Style",
    headline: "Nigeria's Fashion Academy Producing Thousands of Designers",
    excerpt:
      "Prudential Fashion Academy has quietly become one of the most impactful fashion training institutions in West Africa, with over 5,000 graduates.",
    date: "June 2024",
    url: "#",
  },
  {
    publication: "The Cable Lifestyle",
    headline: "Mercy Chinwo's Wedding: The Designers Behind the Looks",
    excerpt:
      "Gospel music's biggest wedding of 2022 featured a show-stopping Prudential Atelier creation for the traditional ceremony that trended for weeks.",
    date: "December 2022",
    url: "#",
  },
  {
    publication: "Pulse Nigeria",
    headline: "Meet the Self-Taught Designer Dressing Nigeria's Elite",
    excerpt:
      "With no formal training, Prudent Gabriel built an atelier employing 85 staff. Her story is a masterclass in determination and craft.",
    date: "March 2024",
    url: "#",
  },
];

export default function PressPage() {
  return (
    <div>
      <section className="flex h-[240px] items-center justify-center bg-charcoal text-center">
        <div>
          <SectionLabel className="text-gold">IN THE NEWS</SectionLabel>
          <h1 className="mt-4 font-display text-4xl italic text-ivory md:text-5xl">As Seen In</h1>
        </div>
      </section>

      <section className="bg-ivory py-16 md:py-20">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 px-4 md:grid-cols-2 md:gap-8">
          {PRESS_ITEMS.map((item) => (
            <article
              key={item.headline}
              className={cn(
                "rounded-sm border border-border bg-cream p-6 transition-all duration-200",
                "hover:-translate-y-0.5 hover:shadow-md",
              )}
            >
              <p className="font-label text-[11px] uppercase tracking-wider text-gold">{item.publication}</p>
              <h2 className="mt-2 font-display text-xl font-semibold leading-snug text-charcoal line-clamp-2">{item.headline}</h2>
              <p className="mt-2 font-body text-sm leading-relaxed text-charcoal-mid line-clamp-3">{item.excerpt}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-charcoal-light">
                <span>{item.date}</span>
                {item.url !== "#" ? (
                  <Link href={item.url} className="font-label text-gold hover:underline" target="_blank" rel="noopener noreferrer">
                    Read Article →
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-ivory-dark py-14 md:py-16">
        <div className="mx-auto max-w-lg px-4 text-center">
          <SectionLabel>PRESS ENQUIRIES</SectionLabel>
          <h2 className="mt-4 font-display text-3xl text-charcoal">Media &amp; Press Contact</h2>
          <p className="mt-4 font-body text-base text-charcoal-mid">
            For interview requests, event coverage, and editorial collaborations:
          </p>
          <a href="mailto:press@prudentgabriel.com" className="mt-4 inline-block font-display text-2xl text-wine hover:underline">
            press@prudentgabriel.com
          </a>
          <p className="mt-3 text-sm text-charcoal-light">We typically respond within 48 hours.</p>
        </div>
      </section>

      <PFABanner />
    </div>
  );
}
