import { getSettings } from "@/lib/settings";

export type HouseDocumentTerm = {
  key: "delivery" | "changes" | "shipping" | "refunds";
  title: string;
  body: string;
};

export const DEFAULT_HOUSE_DOCUMENT_TERMS: HouseDocumentTerm[] = [
  {
    key: "delivery",
    title: "Delivery",
    body: "The house is responsible for producing and delivering the agreed design, in good and useable condition, by the agreed date.",
  },
  {
    key: "changes",
    title: "Changes",
    body: "Modifications to the agreed design may be refused, or accepted at a fee, at the designer's discretion.",
  },
  {
    key: "shipping",
    title: "Shipping",
    body: "Delivery and DHL charges are paid separately once ascertained, just before shipping, and shipping proceeds only on payment confirmation.",
  },
  {
    key: "refunds",
    title: "Refunds",
    body: "Payments are refundable only where the house fails to meet the agreement and cannot offer a reasonable solution.",
  },
];

const KEYS: { key: HouseDocumentTerm["key"]; setting: string; title: string }[] = [
  { key: "delivery", setting: "invoice_term_delivery", title: "Delivery" },
  { key: "changes", setting: "invoice_term_changes", title: "Changes" },
  { key: "shipping", setting: "invoice_term_shipping", title: "Shipping" },
  { key: "refunds", setting: "invoice_term_refunds", title: "Refunds" },
];

export function houseTermsFromValues(values: Record<string, string | undefined>): HouseDocumentTerm[] {
  return KEYS.map((row, i) => {
    const fallback = DEFAULT_HOUSE_DOCUMENT_TERMS[i];
    const body = values[row.setting]?.trim() || fallback.body;
    return { key: row.key, title: row.title, body };
  });
}

export async function getHouseDocumentTerms(): Promise<HouseDocumentTerm[]> {
  const s = await getSettings("INVOICE");
  return houseTermsFromValues(s);
}

export const DEFAULT_INVOICE_FOOTER_HANDLE = "prudentialfashionhouse";
