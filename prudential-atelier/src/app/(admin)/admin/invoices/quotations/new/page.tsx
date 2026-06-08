import { QuotationFormClient } from "@/components/admin/QuotationFormClient";

export default async function AdminInvoiceQuotationNewPage({
  searchParams,
}: {
  searchParams: Promise<{ consultationId?: string }>;
}) {
  const sp = await searchParams;
  return <QuotationFormClient consultationId={sp.consultationId} />;
}
