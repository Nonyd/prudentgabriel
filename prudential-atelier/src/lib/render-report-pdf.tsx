import { renderToBuffer } from "@react-pdf/renderer";
import { ReportPdfDocument, type ReportPdfModel } from "@/components/admin/ReportPDF";

export async function renderReportPdfBuffer(data: ReportPdfModel): Promise<Buffer> {
  const buf = await renderToBuffer(<ReportPdfDocument data={data} />);
  return Buffer.from(buf);
}
