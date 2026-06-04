import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { BespokeStageTracker } from "@/components/bespoke/BespokeStageTracker";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ trackingToken: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { trackingToken } = await params;
  const order = await prisma.bespokeOrder.findUnique({
    where: { trackingToken },
    select: { orderRef: true },
  });
  if (!order) return { title: "Order not found — Prudential Atelier" };
  return { title: `Order ${order.orderRef} — Prudential Atelier` };
}

export default async function TrackOrderPage({ params }: Props) {
  const { trackingToken } = await params;

  const order = await prisma.bespokeOrder.findUnique({
    where: { trackingToken },
    include: { stageHistory: { orderBy: { completedAt: "asc" } } },
  });

  if (!order) {
    return (
      <div className="min-h-screen bg-ivory">
        <header className="border-b border-sand bg-choc px-6 py-5">
          <Link href="/" className="font-serif text-lg tracking-[0.12em] text-cream">
            Prudential Atelier
          </Link>
        </header>
        <div className="mx-auto max-w-lg px-6 py-24 text-center">
          <h1 className="font-display text-3xl text-choc">Order not found</h1>
          <p className="mt-4 font-sans text-sm text-text-mid">
            This tracking link may be invalid or expired. Contact us if you need assistance.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-block border border-nut px-6 py-3 font-sans text-xs font-semibold uppercase tracking-wider text-nut"
          >
            Contact the atelier
          </Link>
        </div>
      </div>
    );
  }

  const firstName = order.clientName.split(" ")[0] ?? order.clientName;

  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-sand bg-choc px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="font-serif text-lg tracking-[0.12em] text-cream">
            Prudential Atelier
          </Link>
          <Link href="/" className="font-sans text-xs text-cream/70 hover:text-cream">
            Back to site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="card-surface p-8">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr">
            Order tracking
          </p>
          <h1 className="mt-2 font-display text-3xl text-choc">{order.orderRef}</h1>
          <p className="mt-2 font-sans text-sm text-text-mid">
            Hello {firstName}
            {order.occasionType ? ` · ${order.occasionType}` : ""}
          </p>
          {order.deliveryDate ? (
            <p className="mt-1 font-sans text-sm text-nut">
              Expected delivery: {formatDate(order.deliveryDate)}
            </p>
          ) : null}
        </div>

        <BespokeStageTracker currentStage={order.currentStage} stageHistory={order.stageHistory} />

        <div className="mt-12 border border-sand bg-bg p-8 text-center">
          <p className="font-display text-xl text-choc">Want to book another piece?</p>
          <Link
            href="/bespoke"
            className="mt-4 inline-block bg-nut px-8 py-3 font-sans text-[10px] font-semibold uppercase tracking-wider text-cream"
          >
            Start a new enquiry
          </Link>
        </div>
      </main>
    </div>
  );
}
