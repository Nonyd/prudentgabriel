import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePdfDocument, type InvoicePdfModel } from "@/components/invoice/InvoicePDF";

export async function renderInvoicePdfBuffer(data: InvoicePdfModel): Promise<Buffer> {
  const buf = await renderToBuffer(<InvoicePdfDocument data={data} />);
  return Buffer.from(buf);
}
