"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { BespokeOrder, BespokeStage, OrderStatus } from "@prisma/client";
import { BulkSelectTable, type BulkColumn } from "@/components/ui/BulkSelectTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import {
  STAGE_LABELS,
  getDeliveryUrgency,
  getOrderTrackStatus,
  getStageProgress,
} from "@/lib/bespoke-stages";
import { cn, formatDate } from "@/lib/utils";

type OrderRow = BespokeOrder;

function StageBadge({ stage }: { stage: BespokeStage }) {
  return (
    <span className="inline-flex rounded-full bg-lightbr/15 px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-wide text-nut">
      {STAGE_LABELS[stage].replace(/^\d+\.\s*/, "")}
    </span>
  );
}

function ProgressBar({ stage }: { stage: BespokeStage }) {
  const progress = getStageProgress(stage);
  const pct = Math.round((progress / 13) * 100);
  return (
    <div className="min-w-[100px]">
      <div className="mb-1 font-sans text-[10px] text-text-light">
        {progress}/13
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand/40">
        <div
          className="h-full rounded-full bg-lightbr transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DeliveryDate({ date }: { date: Date | string | null }) {
  if (!date) return <span className="text-text-light">—</span>;
  const d = new Date(date);
  const urgency = getDeliveryUrgency(d);
  return (
    <span
      className={cn(
        "font-sans text-xs",
        urgency === "overdue" && "font-semibold text-red-700",
        urgency === "soon" && "font-medium text-amber-700",
        urgency === "ok" && "text-text-mid",
      )}
    >
      {formatDate(d)}
    </span>
  );
}

function TrackStatusPill({ order }: { order: OrderRow }) {
  const deliveryDate = order.deliveryDate ? new Date(order.deliveryDate) : null;
  const status = getOrderTrackStatus(deliveryDate, order.currentStage);
  const variant =
    status === "Urgent" ? "wine" : status === "Watch" ? "gold" : "success";
  return <Badge variant={variant}>{status}</Badge>;
}

export function BespokePipelineClient({ initial }: { initial: OrderRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    outfitDescription: "",
    occasionType: "",
    deliveryDate: "",
    totalAmount: "",
  });

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (stageFilter !== "all") params.set("stage", stageFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const res = await fetch(`/api/bespoke?${params}`);
    if (res.ok) {
      const data = (await res.json()) as { items: OrderRow[] };
      setItems(data.items);
    }
  }, [search, stageFilter, statusFilter]);

  useEffect(() => {
    const t = setTimeout(refresh, 300);
    return () => clearTimeout(t);
  }, [refresh]);

  const columns: BulkColumn<OrderRow>[] = useMemo(
    () => [
      {
        key: "ref",
        header: "Order Ref",
        cell: (row) => (
          <Link
            href={`/admin/bespoke/${row.id}`}
            className="font-sans text-sm font-medium text-nut hover:underline"
          >
            {row.orderRef}
          </Link>
        ),
      },
      {
        key: "client",
        header: "Client",
        cell: (row) => (
          <div>
            <p className="font-sans text-sm text-ink">{row.clientName}</p>
            <p className="font-sans text-[11px] text-text-light">{row.clientEmail}</p>
          </div>
        ),
      },
      {
        key: "stage",
        header: "Stage",
        cell: (row) => <StageBadge stage={row.currentStage} />,
      },
      {
        key: "progress",
        header: "Progress",
        cell: (row) => <ProgressBar stage={row.currentStage} />,
      },
      {
        key: "delivery",
        header: "Delivery",
        cell: (row) => <DeliveryDate date={row.deliveryDate} />,
      },
      {
        key: "track",
        header: "Status",
        cell: (row) => <TrackStatusPill order={row} />,
      },
      {
        key: "actions",
        header: "",
        cell: (row) => (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => router.push(`/admin/bespoke/${row.id}`)}>
              View
            </Button>
          </div>
        ),
      },
    ],
    [router],
  );

  const handleBulkDelete = async (ids: string[]) => {
    await Promise.all(ids.map((id) => fetch(`/api/bespoke/${id}`, { method: "DELETE" })));
    toast.success(`Deleted ${ids.length} order(s)`);
    await refresh();
  };

  const createOrder = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/bespoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          totalAmount: form.totalAmount ? parseFloat(form.totalAmount) : 0,
        }),
      });
      if (!res.ok) throw new Error("Failed to create order");
      const data = (await res.json()) as { item: OrderRow };
      toast.success("Order created");
      setModalOpen(false);
      router.push(`/admin/bespoke/${data.item.id}`);
    } catch {
      toast.error("Could not create order");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">Bespoke Orders Pipeline</h1>
          <p className="mt-1 font-sans text-sm text-text-mid">
            13-stage production tracking for couture orders
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>New Bespoke Order</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search ref, client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded border border-sand bg-white px-3 py-2 font-sans text-sm"
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded border border-sand bg-white px-3 py-2 font-sans text-sm"
        >
          <option value="all">All stages</option>
          {Object.entries(STAGE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-sand bg-white px-3 py-2 font-sans text-sm"
        >
          <option value="all">All statuses</option>
          {(["PENDING", "CONFIRMED", "PROCESSING", "DELIVERED", "CANCELLED"] as OrderStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ),
          )}
        </select>
      </div>

      {items.length === 0 ? (
        <div className="card-surface flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="font-display text-xl text-ink">No bespoke orders yet</p>
          <p className="mt-2 max-w-sm font-sans text-sm text-text-mid">
            Create your first production order to start the 13-stage pipeline.
          </p>
          <Button className="mt-6" onClick={() => setModalOpen(true)}>
            New Bespoke Order
          </Button>
        </div>
      ) : (
        <BulkSelectTable
          columns={columns}
          data={items}
          onBulkDelete={handleBulkDelete}
          emptyMessage="No orders match your filters."
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Bespoke Order">
        <div className="space-y-3">
          {(
            [
              ["clientName", "Client name", "text"],
              ["clientEmail", "Email", "email"],
              ["clientPhone", "Phone", "tel"],
              ["occasionType", "Occasion", "text"],
              ["outfitDescription", "Outfit description", "text"],
              ["deliveryDate", "Delivery date", "date"],
              ["totalAmount", "Total amount (NGN)", "number"],
            ] as const
          ).map(([key, label, type]) => (
            <label key={key} className="block">
              <span className="mb-1 block font-sans text-xs font-medium text-text-mid">{label}</span>
              <input
                type={type}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
              />
            </label>
          ))}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={creating} onClick={createOrder}>
              Create Order
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
