"use client";

import { useCallback, useEffect, useState } from "react";
import type { SettingGroup, SettingType } from "@prisma/client";
import { SettingsGroupCard } from "@/components/admin/AdminSettingsClient";

type Row = {
  key: string;
  value: string;
  label: string;
  type: SettingType;
  isPublic: boolean;
  sortOrder: number;
};

function filterKeys(rows: Row[], keys: string[]) {
  const set = new Set(keys);
  return rows.filter((r) => set.has(r.key)).sort((a, b) => a.sortOrder - b.sortOrder);
}

const BUSINESS_KEYS = [
  "invoice_business_name",
  "invoice_tagline",
  "invoice_address_line1",
  "invoice_address_line2",
  "invoice_city",
  "invoice_phone",
  "invoice_email",
  "invoice_website",
  "invoice_rc_number",
  "invoice_show_rc",
  "invoice_logo_url",
];

const BANK_KEYS = [
  "invoice_bank_name_ngn",
  "invoice_account_name_ngn",
  "invoice_account_number_ngn",
  "invoice_bank_name_usd",
  "invoice_account_name_usd",
  "invoice_account_number_usd",
  "invoice_sort_code_usd",
  "invoice_bank_name_gbp",
  "invoice_account_name_gbp",
  "invoice_account_number_gbp",
  "invoice_sort_code_gbp",
];

const DEFAULT_KEYS = [
  "invoice_default_vat",
  "invoice_default_due_days",
  "invoice_default_currency",
  "invoice_footer_note",
  "invoice_deposit_terms",
  "invoice_prefix",
];

export function InvoiceSettingsPageClient() {
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    if (!res.ok) return;
    const j = (await res.json()) as { settings: Partial<Record<SettingGroup, Row[]>> };
    setRows(j.settings.INVOICE ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!rows.length) {
    return <p className="font-body text-sm text-[#6B6B68]">Loading…</p>;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-8">
        <SettingsGroupCard title="Business identity" group="INVOICE" rows={filterKeys(rows, BUSINESS_KEYS)} onSaved={load} />
        <SettingsGroupCard title="Bank details" group="INVOICE" rows={filterKeys(rows, BANK_KEYS)} onSaved={load} />
        <SettingsGroupCard title="Invoice defaults" group="INVOICE" rows={filterKeys(rows, DEFAULT_KEYS)} onSaved={load} />
      </div>
      <aside className="h-fit border border-sand bg-[#FAFAF8] p-5 font-body text-xs text-[#6B6B68]">
        <p className="font-medium uppercase tracking-[0.1em] text-[#37392d]">Preview</p>
        <p className="mt-3">
          Header preview uses <span className="text-ink">{rows.find((r) => r.key === "invoice_business_name")?.value}</span>
          {rows.find((r) => r.key === "invoice_tagline")?.value ? (
            <>
              <br />
              <span className="italic">{rows.find((r) => r.key === "invoice_tagline")?.value}</span>
            </>
          ) : null}
        </p>
      </aside>
    </div>
  );
}
