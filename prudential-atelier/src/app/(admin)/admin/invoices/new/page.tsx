import { InvoiceFormPage } from "@/components/admin/InvoiceFormPage";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ consultationId?: string }>;
}) {
  const sp = await searchParams;
  return <InvoiceFormPage mode="create" consultationId={sp.consultationId} />;
}
