import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InvoiceDetailAdmin } from "@/components/admin/InvoiceDetailAdmin";
import { getBespokeOrderForInvoice } from "@/lib/invoice-bespoke-order";

export default async function AdminInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      bespokeRequest: { select: { id: true, requestNumber: true, occasion: true, status: true } },
    },
  });
  if (!inv) notFound();

  const bespokeOrder = await getBespokeOrderForInvoice({
    bespokeRequestId: inv.bespokeRequestId,
    clientEmail: inv.clientEmail,
  });

  return (
    <InvoiceDetailAdmin
      initial={JSON.parse(JSON.stringify({ ...inv, bespokeOrder }))}
    />
  );
}
