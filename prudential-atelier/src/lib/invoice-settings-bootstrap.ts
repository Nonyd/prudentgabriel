import { SettingGroup, SettingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_HOUSE_DOCUMENT_TERMS, DEFAULT_INVOICE_FOOTER_HANDLE } from "@/lib/invoice-terms";

const INVOICE_SETTING_DEFS: {
  key: string;
  value: string;
  label: string;
  type: SettingType;
  isPublic: boolean;
  sortOrder: number;
}[] = [
  {
    key: "invoice_default_validity_days",
    value: "14",
    label: "Default quote / invoice validity (days)",
    type: SettingType.NUMBER,
    isPublic: false,
    sortOrder: 47,
  },
  {
    key: "invoice_footer_handle",
    value: DEFAULT_INVOICE_FOOTER_HANDLE,
    label: "Invoice footer handle",
    type: SettingType.TEXT,
    isPublic: false,
    sortOrder: 48,
  },
  {
    key: "invoice_term_delivery",
    value: DEFAULT_HOUSE_DOCUMENT_TERMS[0].body,
    label: "Term 1 — Delivery",
    type: SettingType.TEXTAREA,
    isPublic: false,
    sortOrder: 50,
  },
  {
    key: "invoice_term_changes",
    value: DEFAULT_HOUSE_DOCUMENT_TERMS[1].body,
    label: "Term 2 — Changes",
    type: SettingType.TEXTAREA,
    isPublic: false,
    sortOrder: 51,
  },
  {
    key: "invoice_term_shipping",
    value: DEFAULT_HOUSE_DOCUMENT_TERMS[2].body,
    label: "Term 3 — Shipping",
    type: SettingType.TEXTAREA,
    isPublic: false,
    sortOrder: 52,
  },
  {
    key: "invoice_term_refunds",
    value: DEFAULT_HOUSE_DOCUMENT_TERMS[3].body,
    label: "Term 4 — Refunds",
    type: SettingType.TEXTAREA,
    isPublic: false,
    sortOrder: 53,
  },
];

/** Idempotent — creates missing INVOICE SiteSetting rows (safe on every admin load). */
export async function ensureInvoiceSettingKeys(): Promise<void> {
  for (const def of INVOICE_SETTING_DEFS) {
    await prisma.siteSetting.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        value: def.value,
        group: SettingGroup.INVOICE,
        label: def.label,
        type: def.type,
        isPublic: def.isPublic,
        sortOrder: def.sortOrder,
      },
      update: {},
    });
  }
  await prisma.siteSetting.updateMany({
    where: { key: "bespoke_deposit_percent" },
    data: { label: "Default bespoke deposit %" },
  });
}
