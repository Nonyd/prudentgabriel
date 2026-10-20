import { QuotationFormClient } from "@/components/admin/QuotationFormClient";

/** Edit an unsent draft: usually the new version made after the client asked for changes. */
export default async function AdminQuotationEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuotationFormClient editQuotationId={id} />;
}
