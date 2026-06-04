import { renderToBuffer } from "@react-pdf/renderer";
import { MeasurementsPdfDocument, type MeasurementsPdfModel } from "@/components/account/MeasurementsPDF";

export async function renderMeasurementsPdfBuffer(data: MeasurementsPdfModel): Promise<Buffer> {
  const buf = await renderToBuffer(<MeasurementsPdfDocument data={data} />);
  return Buffer.from(buf);
}
