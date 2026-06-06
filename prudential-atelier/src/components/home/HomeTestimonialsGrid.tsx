import { formatLoyaltyTier, type HomepageTestimonial } from "@/lib/testimonials";
import { getInitials } from "@/lib/utils";

function GoldStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-[14px]" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? "text-[#C9A84C]" : "text-sand"}>
          ★
        </span>
      ))}
    </div>
  );
}

function TestimonialCard({ item }: { item: HomepageTestimonial }) {
  const tier = formatLoyaltyTier(item.loyaltyTier);
  const subtitle = [tier, item.productName].filter(Boolean).join(" · ");

  return (
    <article className="flex h-full flex-col rounded-md border border-sand bg-white p-8">
      <GoldStars rating={item.rating} />
      <blockquote className="relative mt-5 flex-1">
        <span
          className="pointer-events-none absolute -left-1 -top-4 font-display text-[48px] leading-none text-sand"
          aria-hidden
        >
          &ldquo;
        </span>
        <p className="relative z-10 font-display text-xl italic leading-[1.7] text-choc">
          {item.body ?? ""}
        </p>
      </blockquote>
      <div className="mt-6 flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lightbr font-display text-base text-white"
          aria-hidden
        >
          {getInitials(item.userName)}
        </div>
        <div className="min-w-0">
          <p className="font-label text-[13px] font-medium text-choc">{item.userName}</p>
          {subtitle ? (
            <p className="font-body text-xs italic text-text-light">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

type HomeTestimonialsGridProps = {
  items: HomepageTestimonial[];
  heading: string;
  subtitle?: string;
};

export function HomeTestimonialsGrid({ items, heading, subtitle }: HomeTestimonialsGridProps) {
  if (items.length === 0) return null;

  return (
    <section className="bg-ivory py-20">
      <div className="mx-auto max-w-site px-4">
        <p className="text-center font-label text-[10px] uppercase tracking-[0.2em] text-lightbr">Client Words</p>
        <h2 className="mt-3 text-center font-display text-[42px] leading-tight text-choc">{heading}</h2>
        {subtitle ? (
          <p className="mx-auto mt-3 max-w-xl text-center font-body text-sm text-text-light">{subtitle}</p>
        ) : null}
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {items.map((item) => (
            <TestimonialCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
