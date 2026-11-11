"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

type Row = {
  id: string;
  orderRef: string;
  title: string;
  clientName: string;
  clientProfileId: string | null;
  deliveryDate: string | null;
  stageLabel: string | null;
  status: string;
  archived: boolean;
  createdAt: string;
};

const FINISHED = new Set(["DELIVERED", "COLLECTED", "CANCELLED", "REFUNDED"]);

/** The Creative Team: every client order, to read. The API refuses anyone else. */
export default function StaffAllOrdersPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [illustrator, setIllustrator] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showFinished, setShowFinished] = useState(false);

  useEffect(() => {
    void fetch("/api/staff/all-orders")
      .then(async (r) => {
        if (!r.ok) {
          setError(r.status === 403 ? "All orders are open to the Creative Team." : "Could not load the orders.");
          return;
        }
        const d = (await r.json()) as { orders: Row[]; illustrator: boolean };
        setRows(d.orders);
        setIllustrator(d.illustrator);
      })
      .catch(() => setError("Could not load the orders."));
  }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((o) => {
      if (!showFinished && (o.archived || FINISHED.has(o.status))) return false;
      if (!q) return true;
      return [o.orderRef, o.title, o.clientName].some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, search, showFinished]);

  if (error) return <p className="staff-card p-4 font-sans text-sm text-text-mid">{error}</p>;
  if (!rows) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-choc" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-choc md:text-3xl">All orders</h1>
        <p className="font-sans text-sm text-text-mid">
          Every client order, to view. {illustrator ? "You can add sketches from each client file." : "Nothing here can be changed."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order number or client"
          aria-label="Search orders"
          className="min-w-0 flex-1 rounded border border-sand bg-bg-card px-3 py-2 font-sans text-sm"
        />
        <label className="flex items-center gap-2 font-sans text-xs text-text-mid">
          <input type="checkbox" checked={showFinished} onChange={(e) => setShowFinished(e.target.checked)} />
          Show delivered and closed
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="staff-card p-4 font-sans text-sm text-text-mid">No orders match.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {shown.map((o) => (
            <div key={o.id} className="staff-card p-4 md:p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-xs font-semibold uppercase tracking-wide text-text-light">{o.orderRef}</p>
                  <p className="mt-1 break-words font-display text-lg text-choc">{o.title}</p>
                  <p className="mt-1 font-sans text-xs text-text-mid">Client: {o.clientName}</p>
                  {o.deliveryDate ? (
                    <p className="mt-1 font-sans text-xs text-text-mid">
                      Delivery: {format(new Date(o.deliveryDate), "d MMM yyyy")}
                    </p>
                  ) : null}
                </div>
                {o.stageLabel ? <Badge variant="gold">{o.stageLabel}</Badge> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 font-sans text-xs">
                {o.clientProfileId ? (
                  <Link href={`/staff/clients/${o.clientProfileId}`} className="font-semibold text-choc underline">
                    Open client file
                  </Link>
                ) : null}
                <Link href={`/staff/orders/${o.id}`} className="text-text-mid underline">
                  Order summary
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
