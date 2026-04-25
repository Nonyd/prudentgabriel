"use client";

export function PFABanner({
  label = "PRUDENTIAL FASHION ACADEMY",
  text = "Over 5,000 designers trained. The school behind the brand.",
  ctaText = "EXPLORE PFA →",
}: {
  label?: string;
  text?: string;
  ctaText?: string;
}) {
  return (
    <section className="border-y border-mid-grey bg-light-grey py-10 md:py-12">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-6 px-6 text-center md:flex-row md:px-8 md:text-left">
        <div className="max-w-xl">
          <p className="font-body text-[10px] font-medium uppercase tracking-[0.25em] text-olive">{label}</p>
          <p className="mt-2 font-body text-[15px] font-light leading-relaxed text-charcoal">{text}</p>
        </div>
        <button
          type="button"
          onClick={() => window.open("https://pfacademy.ng", "_blank")}
          className="shrink-0 border border-ink px-8 py-3 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-ink transition-colors duration-200 hover:bg-ink hover:text-[#ffffff]"
        >
          {ctaText}
        </button>
      </div>
    </section>
  );
}
