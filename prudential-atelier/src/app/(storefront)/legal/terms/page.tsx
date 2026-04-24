export const revalidate = 604800;

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-32 pt-20">
      <h1 className="font-display text-4xl text-wine">Terms of Service</h1>
      <p className="mt-2 text-sm text-charcoal-mid">Last updated: April 24, 2026</p>
      <div className="prose prose-charcoal mt-10 max-w-none font-body text-base leading-relaxed text-charcoal">
        <p>
          By placing an order with Prudential Atelier you agree to these terms. Prices are shown in Nigerian Naira unless
          otherwise stated; international card charges may apply based on your bank.
        </p>
        <h2 className="mt-8 font-display text-2xl text-wine">Orders & acceptance</h2>
        <p>
          An order confirmation email acknowledges receipt; bespoke and made-to-order timelines are estimates. We may
          refuse orders where fraud is suspected.
        </p>
        <h2 className="mt-8 font-display text-2xl text-wine">Intellectual property</h2>
        <p>All designs, photography, and branding remain the property of Prudential Atelier unless agreed in writing.</p>
        <h2 className="mt-8 font-display text-2xl text-wine">Jurisdiction</h2>
        <p>These terms are governed by the laws of Nigeria. Disputes shall be subject to the courts of Lagos, Nigeria.</p>
      </div>
    </article>
  );
}
