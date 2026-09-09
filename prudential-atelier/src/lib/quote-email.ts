import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import { asInvoiceCurrency, formatInvoiceCurrency } from "@/lib/invoice";

export type QuoteEmailLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export function buildQuoteEmailHtml(params: {
  clientName: string;
  quoteRef: string;
  total: number;
  currency: string;
  approvalUrl: string;
  pdfUrl?: string;
  lineItems: QuoteEmailLineItem[];
  notes: string | null;
  consultationSection?: string;
}): string {
  const cur = asInvoiceCurrency(params.currency);
  const money = (n: number) => formatInvoiceCurrency(n, cur);
  const rows = params.lineItems
    .map(
      (item) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #D4BBAC">${item.description}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #D4BBAC;text-align:center">${item.quantity}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #D4BBAC;text-align:right">${money(item.unitPrice)}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #D4BBAC;text-align:right">${money(item.total)}</td></tr>`,
    )
    .join("");

  return `
    <div style="font-family:Georgia,serif;background:#F7F2EC;padding:24px;color:#442913">
      <h1 style="color:#442913;margin:0 0 8px">${CUSTOMER_HOUSE_NAME}</h1>
      <hr style="border:none;border-top:2px solid #98755B;margin:16px 0" />
      <p>Dear ${params.clientName},</p>
      <p>Your quotation <strong>${params.quoteRef}</strong> is ready for review.</p>
      ${params.consultationSection ?? ""}
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead>
          <tr style="background:#E2D1C2">
            <th style="padding:8px;text-align:left">Description</th>
            <th style="padding:8px">Qty</th>
            <th style="padding:8px;text-align:right">Unit</th>
            <th style="padding:8px;text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:18px"><strong>Total: ${money(params.total)}</strong></p>
      ${params.notes ? `<p>${params.notes}</p>` : ""}
      <p><a href="${params.approvalUrl}" style="display:inline-block;background:#5C3422;color:#F7F2EC;padding:12px 24px;text-decoration:none;border-radius:4px">Review &amp; Approve Quote</a></p>
      ${
        params.pdfUrl
          ? `<p style="margin-top:16px;font-size:13px"><a href="${params.pdfUrl}" style="color:#5C3422">Download PDF quotation</a> (for your records)</p>`
          : ""
      }
      <p style="margin-top:32px;font-size:12px;color:#98755B">${CUSTOMER_HOUSE_NAME} · prudentgabriel.com</p>
    </div>
  `;
}
