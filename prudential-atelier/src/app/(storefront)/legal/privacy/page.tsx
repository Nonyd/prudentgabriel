export const revalidate = 604800;

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-32 pt-20">
      <h1 className="font-display text-4xl text-wine">Privacy Policy</h1>
      <p className="mt-2 text-sm text-charcoal-mid">Last updated: April 24, 2026</p>
      <div className="prose prose-charcoal mt-10 max-w-none font-body text-base leading-relaxed text-charcoal">
        <p>
          Prudential Atelier (&ldquo;we&rdquo;) respects your privacy. This policy describes how we collect, use, and
          protect personal information when you shop with us, use our website, or interact with our services in Nigeria
          and internationally.
        </p>
        <h2 className="mt-8 font-display text-2xl text-wine">Data we collect</h2>
        <p>
          We collect information you provide (name, email, phone, shipping address, payment references), technical data
          (cookies, device information), and imagery you upload for bespoke consultations via our approved partners
          (including Cloudinary).
        </p>
        <h2 className="mt-8 font-display text-2xl text-wine">How we use data</h2>
        <p>We use your data to fulfil orders, process payments, communicate about your purchases, and improve our services.</p>
        <h2 className="mt-8 font-display text-2xl text-wine">Your rights</h2>
        <p>You may request access, correction, or deletion of your personal data where applicable law allows.</p>
      </div>
    </article>
  );
}
