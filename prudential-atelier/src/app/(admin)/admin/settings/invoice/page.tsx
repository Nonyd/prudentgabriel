import Link from "next/link";
import { InvoiceSettingsPageClient } from "@/components/admin/settings/InvoiceSettingsPageClient";

export default function AdminInvoiceSettingsPage() {
  return (
    <div>
      <Link href="/admin/settings" className="font-body text-11px font-medium uppercase tracking-[0.12em] text-text-mid hover:text-ink">
        ← Settings
      </Link>
      <h1 className="mt-4 font-display text-2xl text-ink">Invoice settings</h1>
      <p className="mt-1 font-body text-13px text-text-mid">Business details, VAT, and invoice numbering</p>
      <div className="mt-8">
        <InvoiceSettingsPageClient />
      </div>
    </div>
  );
}
