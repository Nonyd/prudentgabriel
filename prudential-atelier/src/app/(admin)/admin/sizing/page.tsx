import { SizingAdminClient } from "@/components/admin/SizingAdminClient";

export default function AdminSizingPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl text-charcoal">Sizing & measurements</h1>
      <p className="mt-1 font-sans text-sm text-text-mid">
        The house chart and the library of measurement questions used on custom orders.
      </p>
      <div className="mt-8">
        <SizingAdminClient />
      </div>
    </div>
  );
}
