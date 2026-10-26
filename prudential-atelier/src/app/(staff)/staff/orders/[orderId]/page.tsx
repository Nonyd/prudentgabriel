"use client";

import Link from "next/link";
import { useEffect, useState, use } from "react";
import { format } from "date-fns";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ConsultationBriefPanel } from "@/components/admin/ConsultationBriefPanel";
import { SpecificationPanel } from "@/components/admin/CommissionFilePanels";

type OrderDetail = {
  orderRef: string;
  outfitDescription: string | null;
  occasionType: string | null;
  occasionDetails: string | null;
  outfitBrief: string | null;
  moodboardImages: string[];
  deliveryDate: string | null;
  currentStage: string;
  currentStageLabel?: string;
  assignment: { role: string; assignedAt: string };
  clientFirstName: string;
  /** The set this commission is cut to, in the house sheet's order. */
  measurements: {
    unit: string;
    notes: string | null;
    rows: { label: string; value: number | string; text: boolean }[];
  } | null;
  materials: { name: string; quantity: string | null; notes: string | null }[];
  stageNotes: { stage: string; notes: string | null; completedAt: string }[];
  images: string[];
  clientProfileId: string | null;
  specification: { key: string; label: string; note: string | null }[];
};

export default function StaffOrderDetailPage(props: { params: Promise<{ orderId: string }> }) {
  const params = use(props.params);
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
        <p className="font-sans text-xs uppercase tracking-wide text-text-light">{order.orderRef}</p>
        <h1 className="font-display text-2xl text-ink">
          {order.outfitDescription ?? "Atelier order"}
        </h1>
        <p className="mt-1 font-sans text-sm text-text-mid">
          Client:{" "}
          {order.clientProfileId ? (
            <Link href={`/staff/clients/${order.clientProfileId}`} className="underline">
              {order.clientFirstName}
            </Link>
          ) : (
            order.clientFirstName
          )}
        </p>
        <p className="font-sans text-sm text-text-mid">
          Your assignment: {order.assignment.role} · Stage {order.currentStageLabel ?? order.currentStage.replace(/_/g, " ")}
        </p>
        {order.deliveryDate ? (
          <p className="mt-2 font-sans text-sm text-choc">
            Delivery: {format(new Date(order.deliveryDate), "EEEE, d MMMM yyyy")}
          </p>
        ) : null}
      </div>

      {order.outfitBrief || order.occasionDetails || order.moodboardImages.length > 0 ? (
        <ConsultationBriefPanel
          variant="staff"
          brief={{
            bookingNumber: order.orderRef,
            occasion: order.occasionDetails ?? order.occasionType,
            outfitBrief: order.outfitBrief ?? order.outfitDescription,
            moodboardImages: order.moodboardImages,
          }}
        />
      ) : null}

      {order.specification.length > 0 ? (
        <section className="rounded-lg border border-sand bg-bg-card p-4">
          <h2 className="mb-3 font-sans text-10px font-semibold uppercase tracking-[0.14em] text-text-mid">
            The gown
          </h2>
          <ul className="flex flex-wrap gap-2 font-sans text-sm">
            {order.specification.map((f) => (
              <li key={f.key} className="border border-sand px-3 py-1.5 text-ink">
                {f.label}
                {f.note ? <span className="text-text-mid"> — {f.note}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {order.measurements ? (
        <section className="rounded-lg border border-sand bg-bg-card p-4">
          <h2 className="mb-3 font-sans text-10px font-semibold uppercase tracking-[0.14em] text-text-mid">
            Measurements
          </h2>
          <dl className="grid grid-cols-2 gap-2 font-sans text-sm">
            {order.measurements.rows.map((r) => (
              <div key={r.label}>
                <dt className="text-text-light">{r.label}</dt>
                <dd className="font-medium text-ink">
                  {r.value}
                  {r.text ? "" : order.measurements!.unit === "cm" ? " cm" : "″"}
                </dd>
              </div>
            ))}
          </dl>
          {order.measurements.rows.length === 0 ? (
            <p className="font-sans text-sm text-text-mid">None taken yet.</p>
          ) : null}
          {order.measurements.notes ? (
            <p className="mt-3 whitespace-pre-wrap font-sans text-sm text-text-mid">{order.measurements.notes}</p>
          ) : null}
        </section>
      ) : null}

      {/* BD3/BD4: beads and fabric for her own job; Maju's grant may add to them. Never their cost. */}
      <SpecificationPanel orderId={params.orderId} mayIssue={false} staffList={[]} actorUserId={null} archived={false} />

      {order.stageNotes.length > 0 ? (
        <section className="rounded-lg border border-sand bg-bg-card p-4">
          <h2 className="mb-3 font-sans text-10px font-semibold uppercase tracking-[0.14em] text-text-mid">
            Instructions from manager
          </h2>
          <ul className="space-y-3">
            {order.stageNotes.map((n) => (
              <li key={n.completedAt} className="font-sans text-sm">
                <p className="text-xs uppercase text-text-light">{n.stage}</p>
                <p className="text-text-mid">{n.notes}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {order.images.length > 0 ? (
        <section>
          <h2 className="mb-3 font-sans text-10px font-semibold uppercase tracking-[0.14em] text-text-mid">
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
