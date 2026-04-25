import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function AdminBespokeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.bespokeRequest.findUnique({ where: { id } });
  if (!row) notFound();

  const agreed = row.agreedPrice ?? row.estimatedPrice;
  const deposit = row.depositPaid ?? 0;
  const balance = agreed != null ? Math.max(0, agreed - deposit) : null;

  return (
    <div>
      <Link href="/admin/bespoke" className="font-body text-[11px] uppercase text-[#6B6B68] hover:text-ink">
        ← Bespoke requests
      </Link>
      <h1 className="mt-4 font-display text-2xl text-ink">{row.requestNumber}</h1>
      <p className="mt-1 font-body text-sm text-[#6B6B68]">
        {row.name} · {row.email} · {row.phone}
      </p>

      {agreed != null ? (
        <div className="mt-8 border border-[#EBEBEA] bg-canvas p-6">
          <p className="font-body text-[11px] font-medium uppercase text-[#6B6B68]">Pricing</p>
          <dl className="mt-4 grid gap-2 font-body text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[#6B6B68]">Agreed price</dt>
              <dd>₦{agreed.toLocaleString("en-NG")}</dd>
            </div>
            <div>
              <dt className="text-[#6B6B68]">Deposit paid</dt>
              <dd>₦{deposit.toLocaleString("en-NG")}</dd>
            </div>
            <div>
              <dt className="text-[#6B6B68]">Balance</dt>
              <dd className={balance && balance > 0 ? "text-[#37392d] font-medium" : "text-green-800"}>
                ₦{(balance ?? 0).toLocaleString("en-NG")}
              </dd>
            </div>
            {row.paymentMethod ? (
              <div>
                <dt className="text-[#6B6B68]">Payment method</dt>
                <dd>{row.paymentMethod}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {row.sketchUrls.length > 0 ? (
        <div className="mt-10">
          <p className="font-body text-[11px] font-medium uppercase text-[#6B6B68]">Sketches</p>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
            {row.sketchUrls.map((url) => {
              const isPdf = url.toLowerCase().includes(".pdf") || url.includes("/raw/");
              return (
                <div key={url} className="relative aspect-square border border-[#EBEBEA] bg-[#fafafa]">
                  {isPdf ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex h-full items-center justify-center p-4 text-center font-body text-xs text-olive underline">
                      PDF — view
                    </a>
                  ) : (
                    <Image src={url} alt="" fill className="object-cover" sizes="200px" unoptimized />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-10 border border-[#EBEBEA] bg-canvas p-6">
        <p className="font-body text-[11px] font-medium uppercase text-[#6B6B68]">Description</p>
        <p className="mt-2 whitespace-pre-wrap font-body text-sm text-charcoal">{row.description}</p>
      </div>

      {row.adminNotes ? (
        <div className="mt-6 border border-[#EBEBEA] bg-[#fafaf8] p-6">
          <p className="font-body text-[11px] font-medium uppercase text-[#6B6B68]">Admin notes</p>
          <p className="mt-2 whitespace-pre-wrap font-body text-sm text-charcoal">{row.adminNotes}</p>
        </div>
      ) : null}
    </div>
  );
}
