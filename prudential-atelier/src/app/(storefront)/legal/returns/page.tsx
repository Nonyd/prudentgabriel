export const revalidate = 604800;

export default function ReturnsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-32 pt-20">
      <h1 className="font-display text-4xl text-wine">Returns & Exchanges</h1>
      <p className="mt-2 text-sm text-charcoal-mid">Last updated: April 24, 2026</p>
      <div className="prose prose-charcoal mt-10 max-w-none font-body text-base leading-relaxed text-charcoal">
        <p>
          We want you to love your piece. Ready-to-wear items may be returned within 14 days of delivery in original
          condition with tags and packaging intact.
        </p>
        <h2 className="mt-8 font-display text-2xl text-wine">Bespoke & altered items</h2>
        <p>Bespoke, made-to-measure, and altered garments are not eligible for return except where required by law.</p>
        <h2 className="mt-8 font-display text-2xl text-wine">How to start a return</h2>
        <p>Email hello@prudentgabriel.com with your order number and reason; our team will guide you through the process.</p>
      </div>
    </article>
  );
}
