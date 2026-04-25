import Link from "next/link";

const steps = [
  {
    title: "Step 1: Log into WordPress Admin",
    detail: "Open yourstore.com/wp-admin and sign in with your admin account.",
  },
  {
    title: "Step 2: Go to Products",
    detail: "Navigate to WooCommerce -> Products -> All Products.",
  },
  {
    title: "Step 3: Click Export",
    detail: "Use the Export button at the top of the products list page.",
  },
  {
    title: "Step 4: Configure Export",
    detail:
      "Set product types to All products, columns to All columns (or at least Name and Images), category to All categories, and quantity to All products.",
  },
  {
    title: "Step 5: Generate and Download",
    detail: "Click Generate CSV and wait for the file download to complete.",
  },
  {
    title: "Step 6: Upload to Prudent Gabriel",
    detail: "Go back to Import Products in admin and upload that downloaded CSV file.",
  },
];

export default function ImportHelpPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl text-ink">How to Export Products from WooCommerce</h1>
      <p className="mt-2 font-body text-sm text-charcoal-mid">
        Follow this guide before using the import tool. Export and import can run in a few minutes when your store image
        URLs are publicly accessible.
      </p>

      <div className="mt-8 space-y-4">
        {steps.map((step) => (
          <article key={step.title} className="rounded-sm border border-border bg-canvas p-5">
            <h2 className="font-body text-sm font-medium text-charcoal">{step.title}</h2>
            <p className="mt-1 text-sm text-charcoal-mid">{step.detail}</p>
          </article>
        ))}
      </div>

      <div className="mt-8 rounded-sm border border-border bg-[#FAFAF8] p-5">
        <h3 className="font-body text-xs font-semibold uppercase tracking-wide text-charcoal">Tips</h3>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-charcoal-mid">
          <li>The file is often named like wc-product-export-[date].csv.</li>
          <li>Typical size is 1-5MB for around 200 products with image URLs.</li>
          <li>Keep the WooCommerce store online while importing so image URLs remain reachable.</li>
        </ul>
      </div>

      <div className="mt-5 rounded-sm border border-amber-300 bg-amber-50 p-5">
        <h3 className="font-body text-xs font-semibold uppercase tracking-wide text-amber-900">Troubleshooting</h3>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">
          <li>No products found: ensure the CSV contains a Name column.</li>
          <li>Images not loading: the source store may be blocking image requests.</li>
          <li>Duplicate products: uncheck duplicates before running import.</li>
        </ul>
      </div>

      <Link href="/admin/import" className="mt-8 inline-flex text-sm text-olive hover:underline">
        ← Back to Import
      </Link>
    </div>
  );
}
