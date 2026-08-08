import { renderToBuffer } from "@react-pdf/renderer";
import { QuotationPdfDocument, type QuotationPdfModel } from "@/components/quotation/QuotationPDF";

export async function renderQuotationPdfBuffer(data: QuotationPdfModel): Promise<Buffer> {
  const buf = await renderToBuffer(<QuotationPdfDocument data={data} />);
  return Buffer.from(buf);
}
