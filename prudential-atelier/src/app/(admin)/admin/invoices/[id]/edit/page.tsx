import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InvoiceFormPage } from "@/components/admin/InvoiceFormPage";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) notFound();
  return <InvoiceFormPage mode="edit" invoiceId={id} />;
}
