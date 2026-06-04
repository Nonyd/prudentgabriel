"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Loader2 } from "lucide-react";

type OrderDetail = {
  orderRef: string;
  outfitDescription: string | null;
  occasionType: string | null;
  deliveryDate: string | null;
  currentStage: string;
  assignment: { role: string; assignedAt: string };
  clientFirstName: string;
  measurements: Record<string, unknown> | null;
  materials: { name: string; quantity: string | null; notes: string | null }[];
  stageNotes: { stage: string; notes: string | null; completedAt: string }[];
  images: string[];
};

export default function StaffOrderDetailPage({ params }: { params: { orderId: string } }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/staff/orders/${params.orderId}`)
      .then(async (r) => {
        if (!r.ok) {
          const d = (await r.json()) as { error?: string };
          setError(d.error ?? "Failed to load");
          return;
        }
        setOrder((await r.json()) as OrderDetail);
      })
      .finally(() => setLoading(false));
  }, [params.orderId]);

  if (loading) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-choc" />;
  if (error || !order) {
    return (
      <div>
        <Link href="/staff" className="mb-4 inline-flex items-center gap-1 font-sans text-xs text-text-mid">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="font-sans text-sm text-text-mid">{error ?? "Order not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/staff" className="inline-flex items-center gap-1 font-sans text-xs text-text-mid">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div>
        <p className="font-sans text-xs uppercase tracking-wide text-lightbr">{order.orderRef}</p>
        <h1 className="font-display text-2xl text-ink">
          {order.outfitDescription ?? "Bespoke order"}
        </h1>
        <p className="mt-1 font-sans text-sm text-text-mid">Client: {order.clientFirstName}</p>
        <p className="font-sans text-sm text-text-mid">
          Your assignment: {order.assignment.role} · Stage {order.currentStage.replace(/_/g, " ")}
        </p>
        {order.deliveryDate ? (
          <p className="mt-2 font-sans text-sm text-choc">
            Delivery: {format(new Date(order.deliveryDate), "EEEE, d MMMM yyyy")}
          </p>
        ) : null}
      </div>

      {order.measurements ? (
        <section className="rounded-lg border border-sand bg-white p-4">
          <h2 className="mb-3 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-mid">
            Measurements
          </h2>
          <dl className="grid grid-cols-2 gap-2 font-sans text-sm">
            {Object.entries(order.measurements).map(([key, value]) =>
              typeof value === "string" || typeof value === "number" ? (
                <div key={key}>
                  <dt className="text-text-light capitalize">{key.replace(/_/g, " ")}</dt>
                  <dd className="font-medium text-ink">{String(value)}</dd>
                </div>
              ) : null,
            )}
          </dl>
        </section>
      ) : null}

      {order.materials.length > 0 ? (
        <section className="rounded-lg border border-sand bg-white p-4">
          <h2 className="mb-3 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-mid">
            Materials
          </h2>
          <ul className="space-y-2 font-sans text-sm">
            {order.materials.map((m, i) => (
              <li key={`${m.name}-${i}`}>
                <span className="font-medium text-ink">{m.name}</span>
                {m.quantity ? <span className="text-text-mid"> · {m.quantity}</span> : null}
                {m.notes ? <p className="text-xs text-text-light">{m.notes}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {order.stageNotes.length > 0 ? (
        <section className="rounded-lg border border-sand bg-white p-4">
          <h2 className="mb-3 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-mid">
            Instructions from manager
          </h2>
          <ul className="space-y-3">
            {order.stageNotes.map((n) => (
              <li key={n.completedAt} className="font-sans text-sm">
                <p className="text-xs uppercase text-lightbr">{n.stage.replace(/_/g, " ")}</p>
                <p className="text-text-mid">{n.notes}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {order.images.length > 0 ? (
        <section>
          <h2 className="mb-3 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-mid">
            Reference images
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {order.images.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" className="aspect-square rounded-md object-cover" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
