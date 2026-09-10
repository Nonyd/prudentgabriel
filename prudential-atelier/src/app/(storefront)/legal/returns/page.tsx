export const revalidate = 3600;

export default function ReturnsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-32 pt-20">
      <h1 className="font-display text-4xl text-choc">Returns & Exchanges</h1>
      <p className="mt-2 text-sm text-charcoal-mid">Last updated: September 10, 2026</p>
      <div className="prose prose-charcoal mt-10 max-w-none font-body text-base leading-relaxed text-charcoal">
        <p>
          We want you to love your piece. Ready-to-wear items may be returned within 14 days of delivery in original
          condition with tags and packaging intact.
        </p>
        <h2 className="mt-8 font-display text-2xl text-choc">Standard size</h2>
        <p>
          Cut to the house chart in your size. Returnable because another woman can wear a standard size.
        </p>
        <h2 className="mt-8 font-display text-2xl text-choc">Made to measure</h2>
        <p>
          Cut to the measurements you entered. It cannot be returned for a change of mind, because a piece made to your
          body cannot be worn by someone else.
        </p>
        <h2 className="mt-8 font-display text-2xl text-choc">Fabric</h2>
        <p>
          If the fabric for your piece is unavailable, we will offer an alternative or a refund within 48 hours.
        </p>
        <h2 className="mt-8 font-display text-2xl text-choc">Atelier &amp; altered items</h2>
        <p>Atelier commissions, made-to-measure, and altered garments are not eligible for return except where required by law.</p>
        <h2 className="mt-8 font-display text-2xl text-choc">How to start a return</h2>
        <p>Email hello@prudentgabriel.com with your order number and reason; our team will guide you through the process.</p>
      </div>
    </article>
  );
}
