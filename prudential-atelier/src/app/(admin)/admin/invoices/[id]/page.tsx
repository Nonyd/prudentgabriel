import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InvoiceDetailAdmin } from "@/components/admin/InvoiceDetailAdmin";

export default async function AdminInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      bespokeRequest: { select: { id: true, requestNumber: true, occasion: true, status: true } },
    },
  });
  if (!inv) notFound();
  return <InvoiceDetailAdmin initial={JSON.parse(JSON.stringify(inv))} />;
}
