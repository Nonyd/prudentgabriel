"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { BespokeStage, OrderStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { STAGE_LABELS, getDeliveryUrgency, getOrderTrackStatus } from "@/lib/bespoke-stages";
import type { CommissionRow } from "@/lib/atelier/commission-list";
import { useHasPermission } from "@/hooks/useHasPermission";
import { cn, formatDate } from "@/lib/utils";

type LibraryFeature = { id: string; key: string; label: string };

function StageBadge({ stage }: { stage: BespokeStage }) {
  return (
    <span className="inline-flex rounded-full bg-lightbr/15 px-2.5 py-1 font-sans text-10px font-semibold uppercase tracking-wide text-nut">
      {STAGE_LABELS[stage].replace(/^\d+\.\s*/, "")}
    </span>
  );
}

function Progress({ progress }: { progress: number }) {
  const pct = Math.round((progress / 13) * 100);
  return (
    <div className="w-28" title={`Stage ${progress} of 13`}>
      <div className="mb-1 font-sans text-10px text-text-light">{progress}/13</div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand/40">
        <div className="h-full rounded-full bg-lightbr" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DeliveryDate({ date }: { date: string | null }) {
  if (!date) return <span className="font-sans text-sm text-text-light">No delivery date</span>;
  const urgency = getDeliveryUrgency(new Date(date));
  return (
    <span
      className={cn(
        "font-sans text-sm",
        urgency === "overdue" && "font-semibold text-red-700",
        urgency === "soon" && "font-medium text-amber-700",
        urgency === "ok" && "text-ink",
      )}
    >
      Delivery {formatDate(date, "d MMM yyyy")}
    </span>
  );
}

function TrackStatusPill({ row }: { row: CommissionRow }) {
  if (row.status === "ARCHIVED") return <Badge variant="grey">Archived</Badge>;
  if (row.currentStage === "DELIVERY") return <Badge variant="success">DELIVERED</Badge>;
  if (row.block === "CLIENT_APPROVAL") return <Badge variant="gold">Awaiting client approval</Badge>;
  if (row.block === "OUTSTANDING_BALANCE") return <Badge variant="wine">Awaiting balance</Badge>;
  const status = getOrderTrackStatus(row.deliveryDate ? new Date(row.deliveryDate) : null, row.currentStage);
  return <Badge variant={status === "Urgent" ? "wine" : status === "Watch" ? "gold" : "success"}>{status}</Badge>;
}

/** BD1: one framed row per commission — title first, readable across a room. */
function CommissionCard({ row, canOpenClients }: { row: CommissionRow; canOpenClients: boolean }) {
  return (
    <li className="card-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/bespoke/${row.id}`}
            className="block font-sans text-lg font-semibold leading-snug text-ink hover:underline"
          >
            {row.title.text}
          </Link>
          <p className="mt-0.5 font-mono text-11px text-text-light">
            {row.orderRef}
            {row.title.partial ? " · no occasion recorded — add a title on the commission" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {row.fabricPending ? <Badge variant="wine">No fabric yet</Badge> : null}
          <TrackStatusPill row={row} />
        </div>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-sans text-sm">
        <div>
          <dt className="sr-only">Client</dt>
          <dd>
            {row.clientProfileId && canOpenClients ? (
              <Link href={`/admin/clients/${row.clientProfileId}`} className="text-ink hover:underline">
                {row.clientName}
              </Link>
            ) : (
              <span className="text-ink">{row.clientName}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Phone</dt>
          <dd>
            {row.phone ? (
              <a href={`tel:${row.phone}`} className="text-ink underline decoration-sand underline-offset-2">
                {row.phone}
              </a>
            ) : (
              <span className="text-text-light">No phone</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Place</dt>
          <dd className={row.place ? "text-ink" : "text-text-light"}>{row.place ?? "Place not recorded"}</dd>
        </div>
        {row.garment ? (
          <div>
            <dt className="sr-only">Garment</dt>
            <dd className="text-nut">{row.garment.label}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5">
          <DeliveryDate date={row.deliveryDate} />
          {row.eventDate ? (
            <p className="font-sans text-xs text-text-mid">Her event {formatDate(row.eventDate, "d MMM yyyy")}</p>
          ) : null}
          {row.features.length ? (
            <p className="font-sans text-xs text-nut">{row.features.map((f) => f.label).join(" · ")}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          <StageBadge stage={row.currentStage} />
          <Progress progress={row.progress} />
        </div>
      </div>
    </li>
  );
}

export function BespokePipelineClient({
  initial,
  initialFabricPending,
}: {
  initial: CommissionRow[];
  initialFabricPending: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [fabricCount, setFabricCount] = useState(initialFabricPending);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [awaitingReceipt, setAwaitingReceipt] = useState(false);
  /** BD5: open commissions that have not passed fabric sourcing. */
  const [fabricPending, setFabricPending] = useState(false);
  /** BC3: "show me May's orders" — a Lagos calendar month, "YYYY-MM". */
  const [deliveryMonth, setDeliveryMonth] = useState("");
  /** BC2: commissions carrying this construction feature. */
  const [featureFilter, setFeatureFilter] = useState("");
  const [library, setLibrary] = useState<LibraryFeature[]>([]);
  const canOpenClients = useHasPermission("clients");
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
    if (showArchived) params.set("showArchived", "1");
    if (awaitingReceipt) params.set("awaitingReceipt", "1");
    if (fabricPending) params.set("fabric", "pending");
    if (deliveryMonth) params.set("deliveryMonth", deliveryMonth);
    if (featureFilter) params.set("feature", featureFilter);
    const res = await fetch(`/api/bespoke?${params}`);
    if (res.ok) {
      const data = (await res.json()) as { items: CommissionRow[]; counts: { fabricPending: number } };
      setItems(data.items);
      setFabricCount(data.counts.fabricPending);
    }
  }, [search, stageFilter, statusFilter, showArchived, awaitingReceipt, fabricPending, deliveryMonth, featureFilter]);

  useEffect(() => {
    void fetch("/api/bespoke/construction-features")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: LibraryFeature[] }) => setLibrary(d.items));
  }, []);

  useEffect(() => {
    const t = setTimeout(refresh, 300);
    return () => clearTimeout(t);
  }, [refresh]);

  const noPlace = items.filter((r) => !r.place).length;

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
      const data = (await res.json()) as { item: { id: string } };
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
          <h1 className="admin-heading-pill glass-1 glass-pill font-display text-2xl text-ink">Atelier Orders Pipeline</h1>
          <p className="mt-1 font-sans text-sm text-text-mid">
            13-stage production tracking for couture orders
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>New Atelier Order</Button>
      </div>

      <DueSoon onPickMonth={setDeliveryMonth} activeMonth={deliveryMonth} />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          aria-pressed={fabricPending}
          onClick={() => setFabricPending((v) => !v)}
          className={cn(
            "rounded border px-3 py-2 font-sans text-sm",
            fabricPending ? "border-choc bg-choc text-ivory" : "border-sand bg-bg-card text-ink",
          )}
        >
          No fabric yet · {fabricCount}
        </button>
        <input
          type="search"
          placeholder="Search ref, client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded border border-sand bg-bg-card px-3 py-2 font-sans text-sm"
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded border border-sand bg-bg-card px-3 py-2 font-sans text-sm"
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
          className="rounded border border-sand bg-bg-card px-3 py-2 font-sans text-sm"
        >
          <option value="all">All statuses</option>
          {(["PENDING", "CONFIRMED", "PROCESSING", "DELIVERED", "ARCHIVED", "CANCELLED"] as OrderStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ),
          )}
        </select>
        <label className="flex items-center gap-2 font-sans text-xs text-text-mid">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
        <label className="flex items-center gap-2 font-sans text-xs text-text-mid">
          <input
            type="checkbox"
            checked={awaitingReceipt}
            onChange={(e) => setAwaitingReceipt(e.target.checked)}
          />
          Awaiting receipt confirm
        </label>
        <select
          value={featureFilter}
          onChange={(e) => setFeatureFilter(e.target.value)}
          aria-label="Construction feature"
          className="rounded border border-sand bg-bg-card px-3 py-2 font-sans text-sm"
        >
          <option value="">Any construction</option>
          {library.map((f) => (
            <option key={f.id} value={f.key}>
              With {f.label.toLowerCase()}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 font-sans text-xs text-text-mid">
          Delivery month
          <input
            type="month"
            value={deliveryMonth}
            onChange={(e) => setDeliveryMonth(e.target.value)}
            className="rounded border border-sand bg-bg-card px-2 py-1.5 font-sans text-sm"
          />
          {deliveryMonth ? (
            <button type="button" className="underline" onClick={() => setDeliveryMonth("")}>
              clear
            </button>
          ) : null}
        </label>
      </div>

      {noPlace > 0 ? (
        <p className="font-sans text-xs text-text-mid">
          Place fills itself for commissions converted from an enquiry; {noPlace} of these {items.length} have none
          recorded (made before the enquiry asked, or entered by hand). Add it on the commission.
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="card-surface flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="font-display text-xl text-ink">
            {fabricPending ? "Every open commission has its fabric" : "No atelier orders match"}
          </p>
          {!fabricPending ? (
            <Button className="mt-6" onClick={() => setModalOpen(true)}>
              New Atelier Order
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <CommissionCard key={row.id} row={row} canOpenClients={canOpenClients} />
          ))}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Atelier Order">
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

type DueItem = {
  id: string;
  orderRef: string;
  clientName: string;
  deliveryDate: string | null;
  currentStage: BespokeStage;
  deliveredAt: string | null;
  overdue: boolean;
};
type DueMonth = { month: string; label: string; items: DueItem[] };

/** Slice BC3: what is due this month and next — the question behind "show me May's orders". */
function DueSoon({ onPickMonth, activeMonth }: { onPickMonth: (m: string) => void; activeMonth: string }) {
  const [due, setDue] = useState<{ thisMonth: DueMonth; nextMonth: DueMonth; undatedOpen: number } | null>(null);
  useEffect(() => {
    void fetch("/api/bespoke/due")
      .then((r) => (r.ok ? r.json() : null))
      .then(setDue);
  }, []);
  if (!due) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[due.thisMonth, due.nextMonth].map((m) => (
        <section key={m.month} className="card-surface p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-text-light">
              Due in {m.label} · {m.items.length}
            </h2>
            <button
              type="button"
              onClick={() => onPickMonth(activeMonth === m.month ? "" : m.month)}
              className="font-sans text-xs text-nut underline"
            >
              {activeMonth === m.month ? "Show all" : "Filter to this month"}
            </button>
          </div>
          {m.items.length === 0 ? (
            <p className="mt-2 font-sans text-sm text-text-mid">Nothing due.</p>
          ) : (
            <ul className="mt-2 space-y-1 font-sans text-sm">
              {m.items.slice(0, 6).map((o) => (
                <li key={o.id} className="flex justify-between gap-2">
                  <Link href={`/admin/bespoke/${o.id}`} className="truncate text-ink hover:underline">
                    {o.orderRef} · {o.clientName}
                  </Link>
                  <span className={cn("shrink-0", o.overdue ? "text-red-700" : "text-text-mid")}>
                    {o.deliveredAt ? "delivered" : o.deliveryDate ? formatDate(o.deliveryDate, "d MMM") : ""}
                    {o.overdue ? " · overdue" : ""}
                  </span>
                </li>
              ))}
              {m.items.length > 6 ? (
                <li className="text-xs text-text-light">and {m.items.length - 6} more</li>
              ) : null}
            </ul>
          )}
        </section>
      ))}
      {due.undatedOpen > 0 ? (
        <p className="font-sans text-xs text-text-mid md:col-span-2">
          {due.undatedOpen} open commission{due.undatedOpen === 1 ? " has" : "s have"} no delivery date yet.
        </p>
      ) : null}
    </div>
  );
}
