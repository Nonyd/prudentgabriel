import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GenerateInvoiceButton } from "@/components/admin/GenerateInvoiceButton";
import { BespokeStatus } from "@prisma/client";
import Image from "next/image";

export default async function AdminBespokeIntakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await prisma.bespokeRequest.findUnique({ where: { id } });
  if (!row) notFound();

  const existingInvoice = await prisma.invoice.findFirst({
    where: { bespokeRequestId: id },
    select: { id: true },
  });

  const agreed = row.agreedPrice ?? row.estimatedPrice;
  const deposit = row.depositPaid ?? 0;
  const balance = agreed != null ? Math.max(0, agreed - deposit) : null;
  const showGenerate =
    (row.status === BespokeStatus.CONFIRMED || row.status === BespokeStatus.IN_PROGRESS) &&
    !existingInvoice;

  return (
    <div>
      <Link href="/admin/bespoke/intake" className="font-sans text-[11px] uppercase text-text-light hover:text-nut">
        ← Intake requests
      </Link>
      <h1 className="mt-4 font-display text-2xl text-ink">{row.requestNumber}</h1>
      <p className="mt-1 font-sans text-sm text-text-mid">
        {row.name} · {row.email} · {row.phone}
      </p>
      {showGenerate ? <GenerateInvoiceButton bespokeId={row.id} /> : null}
      {agreed != null ? (
        <div className="card-surface mt-8 p-6">
          <p className="font-sans text-[11px] font-medium uppercase text-text-light">Pricing</p>
          <dl className="mt-4 grid gap-2 font-sans text-sm sm:grid-cols-2">
            <div>
              <dt className="text-text-light">Agreed price</dt>
              <dd>₦{agreed.toLocaleString("en-NG")}</dd>
            </div>
            <div>
              <dt className="text-text-light">Deposit paid</dt>
              <dd>₦{deposit.toLocaleString("en-NG")}</dd>
            </div>
            <div>
              <dt className="text-text-light">Balance</dt>
              <dd>₦{(balance ?? 0).toLocaleString("en-NG")}</dd>
            </div>
          </dl>
        </div>
      ) : null}
      {row.sketchUrls.length > 0 ? (
        <div className="mt-10 grid grid-cols-2 gap-2 md:grid-cols-3">
          {row.sketchUrls.map((url) => (
            <div key={url} className="relative aspect-square border border-sand">
              <Image src={url} alt="" fill className="object-cover" sizes="200px" unoptimized />
            </div>
          ))}
        </div>
      ) : null}
      <div className="card-surface mt-10 p-6">
        <p className="whitespace-pre-wrap font-sans text-sm">{row.description}</p>
      </div>
    </div>
  );
}
