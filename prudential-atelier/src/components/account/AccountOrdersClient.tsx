"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { BespokeOrder, BespokeStage, Order, OrderItem, Product, ProductImage, StageUpdate } from "@prisma/client";
import { BespokeStageTracker } from "@/components/bespoke/BespokeStageTracker";
import { ConsultationBriefPanel } from "@/components/admin/ConsultationBriefPanel";
import { STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";
import { formatDate, formatPrice } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";

type RtwOrder = Order & {
  items: (OrderItem & {
    product: Product & { images: ProductImage[] };
  })[];
};

type Bespoke = BespokeOrder & {
  stageHistory: StageUpdate[];
  consultation?: { bookingNumber: string } | null;
};

export function AccountOrdersClient({
  bespokeOrders,
  rtwOrders,
  atelierEnabled = true,
}: {
  bespokeOrders: Bespoke[];
  rtwOrders: RtwOrder[];
  atelierEnabled?: boolean;
}) {
  const [tab, setTab] = useState<"bespoke" | "rtw">(atelierEnabled ? "bespoke" : "rtw");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rtwDetail, setRtwDetail] = useState<RtwOrder | null>(null);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-4xl text-choc">My Orders</h1>
      <div className="mt-6 flex gap-2 border-b border-sand">
        {(atelierEnabled ? (["bespoke", "rtw"] as const) : (["rtw"] as const)).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 font-sans text-xs uppercase tracking-wider ${
              tab === t ? "border-b-2 border-nut text-nut" : "text-text-mid"
            }`}
          >
            {t === "bespoke" ? "Atelier Orders" : "Ready-to-Wear"}
          </button>
        ))}
      </div>

      {tab === "bespoke" ? (
        bespokeOrders.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="font-sans text-sm text-text-mid">
              No atelier orders yet — book a consultation to get started
            </p>
            <Link href="/consultation" className="btn-primary mt-4 inline-flex">
              Book consultation
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {bespokeOrders.map((o) => (
              <li key={o.id} className="card-surface overflow-hidden">
                <button
                  type="button"
                  className="w-full p-5 text-left"
                  onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-sans text-[10px] uppercase tracking-wider text-lightbr">{o.orderRef}</p>
                      <p className="mt-1 font-display text-lg text-choc">
                        {o.outfitDescription?.slice(0, 80) ?? "Atelier order"}
                      </p>
                      {o.deliveryDate ? (
                        <p className="mt-1 font-sans text-xs text-text-mid">
                          Delivery: {formatDate(o.deliveryDate)}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-sm bg-nut/10 px-2 py-1 font-sans text-[10px] uppercase text-nut">
                      {STAGE_SHORT_LABELS[o.currentStage as BespokeStage]}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 font-sans text-xs text-text-mid">
                    <span>Total: {formatPrice(o.totalAmount, "NGN")}</span>
                    <span>Paid: {formatPrice(o.amountPaid, "NGN")}</span>
                    {o.balance > 0 ? (
                      <span className="text-nut">Balance: {formatPrice(o.balance, "NGN")}</span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link
                      href={`/account/orders/bespoke/${o.id}`}
                      className="font-sans text-xs text-nut underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View commission
                    </Link>
                    {o.balance > 0 ? (
                      <Link
                        href={`/account/orders/bespoke/${o.id}/pay`}
                        className="font-sans text-xs text-nut underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Pay Balance
                      </Link>
                    ) : null}
                  </div>
                </button>
                {expanded === o.id ? (
                  <div className="space-y-5 border-t border-sand px-5 pb-5 pt-5">
                    {o.consultationId ? (
                      <ConsultationBriefPanel
                        variant="client"
                        brief={{
                          bookingNumber: o.consultation?.bookingNumber ?? "",
                          occasion: o.occasionDetails ?? o.occasionType,
                          outfitBrief: o.outfitBrief ?? o.sessionNotes ?? o.outfitDescription,
                          moodboardImages: o.moodboardImages ?? [],
                          adminHref: "/account/moodboards",
                        }}
                      />
                    ) : null}
                    <BespokeStageTracker
                      currentStage={o.currentStage}
                      stageHistory={o.stageHistory}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : rtwOrders.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="font-sans text-sm text-text-mid">No orders yet</p>
          <Link href="/shop" className="btn-primary mt-4 inline-flex">
            Shop now
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {rtwOrders.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => setRtwDetail(o)}
                className="flex w-full items-center justify-between border border-sand/60 bg-ivory p-4 text-left transition hover:border-nut/30"
              >
                <div>
                  <p className="font-sans text-xs text-lightbr">{o.orderNumber}</p>
                  <p className="font-sans text-sm text-choc">{formatDate(o.createdAt)}</p>
                  <p className="font-sans text-xs text-text-mid">
                    {o.items.length} item{o.items.length !== 1 ? "s" : ""}
                    {o.trackingNumber ? ` · ${o.trackingNumber}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-sans text-sm text-choc">{formatPrice(o.total, "NGN")}</p>
                  <span className="font-sans text-[10px] uppercase text-lightbr">{o.status}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!rtwDetail} onClose={() => setRtwDetail(null)} title="Order details">
        {rtwDetail ? (
          <div className="space-y-4">
            <p className="font-sans text-sm text-text-mid">{rtwDetail.orderNumber}</p>
            <ul className="space-y-3">
              {rtwDetail.items.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <div className="relative h-16 w-16 shrink-0 bg-bg">
                    {item.product.images[0]?.url ? (
                      <Image
                        src={item.product.images[0].url}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <div>
                    <p className="font-sans text-sm text-choc">{item.product.name}</p>
                    <p className="font-sans text-xs text-text-light">
                      Size {item.size} · Qty {item.quantity}
                    </p>
                    <p className="font-sans text-sm text-nut">{formatPrice(item.price, "NGN")}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
