import { JsonLd } from "@/components/seo/JsonLd";
import { faqJsonLd } from "@/lib/seo-jsonld";
import type { FaqItem } from "@/lib/seo-copy";

/**
 * Questions answered in plain words, visible on the page, with matching FAQPage
 * JSON-LD. Search engines and AI assistants quote these answers directly.
 */
export function HouseFaq({
  eyebrow,
  heading,
  intro,
  items,
}: {
  eyebrow: string;
  heading: string;
  intro?: string;
  items: FaqItem[];
}) {
  return (
    <section aria-labelledby="house-faq-heading" className="px-6 py-20 lg:px-10 lg:py-24">
      <JsonLd data={faqJsonLd(items)} />
      <div className="mx-auto grid max-w-[1100px] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
        <div>
          <p className="font-label text-[10px] uppercase tracking-[0.22em] text-charcoal-light">{eyebrow}</p>
          <h2 id="house-faq-heading" className="mt-3 font-display text-3xl font-light leading-tight text-charcoal lg:text-4xl">
            {heading}
          </h2>
          {intro ? <p className="mt-4 max-w-sm font-body text-sm leading-7 text-charcoal-mid">{intro}</p> : null}
        </div>
        <div className="border-t border-choc/15">
          {items.map((item) => (
            <details key={item.question} className="group border-b border-choc/15">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 font-display text-lg text-charcoal marker:hidden [&::-webkit-details-marker]:hidden">
                <h3 className="font-display text-lg font-normal">{item.question}</h3>
                <span
                  aria-hidden
                  className="mt-1 shrink-0 font-label text-lg leading-none text-choc transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pb-6 pr-8 font-body text-sm leading-7 text-charcoal-mid">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
