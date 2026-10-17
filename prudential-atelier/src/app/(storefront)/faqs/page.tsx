import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Mail, MapPin } from "lucide-react";
import { FaqBrowser } from "@/components/faq/FaqBrowser";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCMSContent } from "@/lib/cms";
import { cmsGet } from "@/lib/cms-helpers";
import { getConsultationFeeNGN } from "@/lib/consultation-fees";
import { buildFaq, FAQ_DEFAULT_EMAIL, type FaqConsultationFees, type FaqFacts } from "@/lib/faq-content";
import {
  HOUSE_ADDRESS_LINE_1,
  HOUSE_ADDRESS_LINE_2,
  resolveHouseAddressLine1,
  resolveHouseAddressLine2,
} from "@/lib/house-address";
import { resolveLegalTokens } from "@/lib/legal-tokens";
import { getLoyaltyRulePoints } from "@/lib/loyalty";
import { getTierConfigs } from "@/lib/loyalty-tiers";
import { LOYALTY_ACTIONS, PROGRAMME_DEFAULTS } from "@/lib/points-value";
import { routeMetadata } from "@/lib/seo";
import { PAGE_SEO_FALLBACKS } from "@/lib/seo-copy";
import { faqJsonLd } from "@/lib/seo-jsonld";

/** Live figures: re-read every few minutes so an answer never outlives a setting. */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return routeMetadata("faqs", "/faqs", PAGE_SEO_FALLBACKS.faqs!);
}

const CONTACT_KEYS = [
  "contact_lagos_address_1",
  "contact_lagos_address_2",
  "contact_email",
  "contact_hours_weekday",
  "contact_hours_saturday",
];

async function safe<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch {
    return fallback;
  }
}

async function loadFacts(): Promise<FaqFacts> {
  const [tokens, cms, fees, review, newsletter, styleProfile, birthday, tiers] = await Promise.all([
    safe<Record<string, string>>(() => resolveLegalTokens(), {}),
    safe<Record<string, string>>(() => getCMSContent(CONTACT_KEYS), {}),
    safe<FaqConsultationFees | null>(async () => {
      const [physicalPrudent, physicalTeam, virtualPrudent, virtualTeam] = await Promise.all([
        getConsultationFeeNGN("PHYSICAL_PRUDENT_TEAM"),
        getConsultationFeeNGN("PHYSICAL_TEAM_ONLY"),
        getConsultationFeeNGN("VIRTUAL_PRUDENT_TEAM"),
        getConsultationFeeNGN("VIRTUAL_TEAM_ONLY"),
      ]);
      return { physicalPrudent, physicalTeam, virtualPrudent, virtualTeam };
    }, null),
    safe(() => getLoyaltyRulePoints(LOYALTY_ACTIONS.REVIEW), PROGRAMME_DEFAULTS[LOYALTY_ACTIONS.REVIEW] ?? 0),
    safe(() => getLoyaltyRulePoints(LOYALTY_ACTIONS.NEWSLETTER), PROGRAMME_DEFAULTS[LOYALTY_ACTIONS.NEWSLETTER] ?? 0),
    safe(() => getLoyaltyRulePoints(LOYALTY_ACTIONS.STYLE_PROFILE), PROGRAMME_DEFAULTS[LOYALTY_ACTIONS.STYLE_PROFILE] ?? 0),
    safe(() => getLoyaltyRulePoints(LOYALTY_ACTIONS.BIRTHDAY), PROGRAMME_DEFAULTS[LOYALTY_ACTIONS.BIRTHDAY] ?? 0),
    safe<FaqFacts["tiers"]>(async () => {
      const t = await getTierConfigs();
      const min = (tier: string) => t.find((c) => c.tier === tier)?.minSpendNGN ?? 0;
      return { silver: min("SILVER"), gold: min("GOLD"), platinum: min("PLATINUM") };
    }, null),
  ]);

  return {
    tokens,
    email: cmsGet(cms, "contact_email", "") || FAQ_DEFAULT_EMAIL,
    addressLines: [
      resolveHouseAddressLine1(cmsGet(cms, "contact_lagos_address_1", HOUSE_ADDRESS_LINE_1)),
      resolveHouseAddressLine2(cmsGet(cms, "contact_lagos_address_2", HOUSE_ADDRESS_LINE_2)),
    ],
    hours: [
      cmsGet(cms, "contact_hours_weekday", "Monday – Friday: 9:00 AM – 6:00 PM"),
      cmsGet(cms, "contact_hours_saturday", "Saturday: 10:00 AM – 4:00 PM"),
      "Sunday: Closed",
    ],
    consultationFees: fees,
    bonusPoints: { review, newsletter, styleProfile, birthday },
    tiers,
  };
}

export default async function FaqsPage() {
  const facts = await loadFacts();
  const sections = buildFaq(facts);
  const jsonLd = faqJsonLd(
    sections.flatMap((s) => s.items.map((item) => ({ question: item.q, answer: item.plain }))),
  );

  return (
    <div className="overflow-x-clip">
      <JsonLd data={jsonLd} />

      <header className="relative px-6 pb-12 pt-16 text-center lg:px-10 lg:pb-16 lg:pt-24">
        <p className="font-label text-[10px] uppercase tracking-[0.28em] text-charcoal-light">Questions</p>
        <h1 className="mx-auto mt-4 max-w-3xl font-display text-[2.6rem] font-light leading-[1.05] text-choc sm:text-[3.4rem] lg:text-[4.25rem]">
          Frequently asked questions
        </h1>
        <div aria-hidden className="mx-auto mt-6 flex items-center justify-center gap-3">
          <span className="h-px w-10 bg-gold/60" />
          <span className="h-1.5 w-1.5 rotate-45 bg-gold" />
          <span className="h-px w-10 bg-gold/60" />
        </div>
        <p className="mx-auto mt-6 max-w-xl font-body text-[15px] leading-7 text-charcoal-mid sm:text-base">
          Everything we make is made to order in our atelier in Ajah, Lagos. Here is how ordering, sizing, delivery and
          our bespoke and bridal commissions work, in plain words, with the figures as they stand today.
        </p>
      </header>

      <div className="mx-auto max-w-[1180px] px-6 pb-20 lg:px-10 lg:pb-28">
        <FaqBrowser sections={sections} email={facts.email} />

        <aside
          aria-labelledby="faq-still-heading"
          className="glass-2 glass-panel mt-20 overflow-hidden p-6 sm:p-10 lg:mt-28 lg:p-14"
        >
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <p className="font-label text-[10px] uppercase tracking-[0.24em] text-charcoal-light">We are here</p>
              <h2 id="faq-still-heading" className="mt-3 font-display text-[2rem] font-light leading-tight text-charcoal sm:text-[2.5rem]">
                Still have a question?
              </h2>
              <p className="mt-4 max-w-md font-body text-[15px] leading-7 text-charcoal-mid">
                Write to us and a member of the atelier will answer you personally. While we are open, the chat on this
                site reaches us too; when we are closed, we reply by email.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full bg-choc px-6 py-3 font-label text-[11px] uppercase tracking-[0.18em] text-ivory transition-opacity hover:opacity-90"
                >
                  Contact us
                  <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} />
                </Link>
                <Link
                  href="/consultation"
                  className="inline-flex items-center gap-2 rounded-full border border-choc/30 px-6 py-3 font-label text-[11px] uppercase tracking-[0.18em] text-choc transition-colors hover:border-choc"
                >
                  Enquire about a commission
                </Link>
              </div>
            </div>

            <dl className="space-y-6 border-t border-choc/15 pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
              <div className="flex gap-4">
                <Mail aria-hidden className="mt-1 h-4 w-4 shrink-0 text-gold" strokeWidth={1.5} />
                <div className="min-w-0">
                  <dt className="font-label text-[10px] uppercase tracking-[0.2em] text-charcoal-light">Email</dt>
                  <dd className="mt-1 font-body text-[15px] text-charcoal">
                    <a href={`mailto:${facts.email}`} className="break-words hover:text-choc hover:underline">
                      {facts.email}
                    </a>
                  </dd>
                </div>
              </div>
              <div className="flex gap-4">
                <MapPin aria-hidden className="mt-1 h-4 w-4 shrink-0 text-gold" strokeWidth={1.5} />
                <div className="min-w-0">
                  <dt className="font-label text-[10px] uppercase tracking-[0.2em] text-charcoal-light">The atelier</dt>
                  <dd className="mt-1 font-body text-[15px] leading-7 text-charcoal">
                    {facts.addressLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </dd>
                </div>
              </div>
              <div className="flex gap-4">
                <Clock aria-hidden className="mt-1 h-4 w-4 shrink-0 text-gold" strokeWidth={1.5} />
                <div className="min-w-0">
                  <dt className="font-label text-[10px] uppercase tracking-[0.2em] text-charcoal-light">Opening hours</dt>
                  <dd className="mt-1 font-body text-[15px] leading-7 text-charcoal">
                    {facts.hours.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </dd>
                </div>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
