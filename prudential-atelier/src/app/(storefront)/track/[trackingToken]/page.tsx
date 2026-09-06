import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { BespokeStageTracker } from "@/components/bespoke/BespokeStageTracker";
import { TrackOrderActions } from "@/components/track/TrackOrderActions";
import { TrackSearchForm } from "@/components/track/TrackSearchForm";
import { getStageProgress } from "@/lib/bespoke-stages";
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
    select: {
      orderRef: true,
      clientName: true,
      deliveryDate: true,
      outfitDescription: true,
      currentStage: true,
      stageHistory: { orderBy: { completedAt: "asc" }, select: { stage: true, completedAt: true } },
    },
  });

  if (!order) {
    return (
      <div className="min-h-screen">
        <TrackSearchForm notFound />
        <div className="pb-16 text-center">
          <Link
            href="/contact"
            className="inline-block border border-choc px-6 py-3 font-sans text-[10px] font-semibold uppercase tracking-wider text-choc"
          >
            Contact the atelier
          </Link>
        </div>
      </div>
    );
  }

  const firstName = order.clientName.split(" ")[0] ?? order.clientName;
  const outfitName = order.outfitDescription?.split("\n")[0]?.slice(0, 80) || "Atelier commission";
  const stagesComplete = getStageProgress(order.currentStage);

  return (
    <div className="min-h-screen">
      <div className="border-b border-sand px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-serif text-[40px] font-normal text-choc md:text-[52px]">Follow your commission</h1>
          <p className="mt-2 font-body text-[14px] text-text-light">No login required — just your order reference.</p>
          <Link
            href="/track"
            className="mt-4 inline-block font-sans text-[10px] uppercase tracking-wider text-nut hover:underline"
          >
            Track another order
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 pb-16 md:px-6">
        <div className="glass-2 glass-panel px-7 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-sans text-[13px] font-normal text-text-mid">Order {order.orderRef}</p>
              <h2 className="mt-2 font-serif text-[26px] leading-snug text-choc">{outfitName}</h2>
              <p className="mt-2 font-sans text-[12px] text-text-mid">
                Atelier commission for {firstName}
                {order.deliveryDate ? ` · Est. delivery ${formatDate(order.deliveryDate)}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-serif text-[42px] leading-none text-choc">
                {stagesComplete}
                <span className="text-[22px] text-text-light">/13</span>
              </p>
              <p className="mt-1 font-sans text-[13px] font-normal text-text-mid">Stages complete</p>
            </div>
          </div>
        </div>

        <BespokeStageTracker currentStage={order.currentStage} stageHistory={order.stageHistory} />

        <p className="mt-8 text-center font-body text-[12px] text-text-light">
          Crafted by our atelier team with care at every stage.
        </p>

        <TrackOrderActions />
      </main>
    </div>
  );
}
