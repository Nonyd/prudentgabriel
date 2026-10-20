import { formatPrice } from "@/lib/currency";
import type { ConsultationFeeQuote } from "@/lib/consultation-fees";
import { OFFERING_TYPES, getOfferingTypeConfig, type OfferingTypeKey } from "@/lib/consultation-types";

/**
 * The consultation fees, shown before she fills in the enquiry, so the cost is
 * known up front. Same settings and figures as the booking page (BA3); only
 * the types the house offers are listed.
 */
export function ConsultationFeeNotice({
  fees,
  cms,
}: {
  fees: Record<OfferingTypeKey, ConsultationFeeQuote>;
  cms: Record<string, string>;
}) {
  const types = OFFERING_TYPES.map((key) => getOfferingTypeConfig(key, cms)).filter((t) => t.enabled);
  if (!types.length) return null;

  return (
    <section
      aria-labelledby="consultation-fees-heading"
      className="mx-auto mb-10 max-w-3xl glass-2 glass-panel px-5 py-6 sm:px-8"
    >
      <h2 id="consultation-fees-heading" className="text-center font-serif text-[26px] leading-tight text-choc">
        Consultation fees
      </h2>
      <p className="mx-auto mt-2 max-w-[520px] text-center font-body text-[14px] leading-relaxed text-text-mid">
        Paid when you book, once Prudent Gabriel accepts your enquiry. The fee is non-refundable and is not
        credited towards the price of a commission.
      </p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {types.map((t) => (
          <li key={t.key} className="flex items-start justify-between gap-4 rounded-sm border border-sand/70 bg-bg-card/60 px-4 py-3">
            <div className="min-w-0">
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-nut">{t.formatLabel}</p>
              <p className="mt-1 font-body text-[14px] leading-snug text-choc">{t.title}</p>
              <p className="mt-0.5 font-body text-[12px] text-text-mid">{t.duration}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-serif text-[24px] leading-none text-choc">{formatPrice(fees[t.key].NGN, "NGN")}</p>
              <p className="mt-1 font-sans text-[11px] text-text-mid">
                ≈ {formatPrice(fees[t.key].USD, "USD")} · {formatPrice(fees[t.key].GBP, "GBP")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
