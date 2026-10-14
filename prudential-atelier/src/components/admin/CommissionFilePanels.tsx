"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { ClientMeasurementsPanel } from "@/components/admin/ClientMeasurementsPanel";
import {
  MATERIAL_KINDS,
  MATERIAL_KIND_LABELS,
  splitSpecification,
  type MaterialKind,
  type MaterialRow,
} from "@/lib/atelier/commission-materials-shared";
import type { CommissionCost } from "@/lib/atelier/commission-cost";
import type { CommissionMeasurements } from "@/lib/atelier/commission-measurements";
import { uploadAdminAsset } from "@/lib/admin-upload-xhr";
import { formatNGN, formatDate } from "@/lib/utils";

const H2 = "font-sans text-xs font-semibold uppercase tracking-wider text-text-light";
const FIELD = "w-full rounded border border-sand px-2 py-2 font-sans text-sm";

/** A section this viewer may not see: say it exists and whose it is (BC1 behaviour). */
export function LockedSection({ title, reason }: { title: string; reason: string }) {
  return (
    <section className="card-surface border-dashed p-6 opacity-80">
      <h2 className={H2}>{title}</h2>
      <p className="mt-2 font-sans text-sm text-text-mid">{reason}</p>
    </section>
  );
}

/* ── BD1: what this commission is ─────────────────────────────────────────── */

type GarmentOption = { id: string; label: string };

export function CommissionIdentityPanel({
  orderId,
  composedTitle,
  initial,
  canEdit,
}: {
  orderId: string;
  /** What the title reads as without an override. */
  composedTitle: string;
  initial: {
    title: string | null;
    garmentTypeId: string | null;
    occasionDetails: string | null;
    eventDate: string | null;
    clientLocation: string | null;
    eventLocation: string | null;
  };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: initial.title ?? "",
    garmentTypeId: initial.garmentTypeId ?? "",
    occasionDetails: initial.occasionDetails ?? "",
    eventDate: initial.eventDate ? initial.eventDate.slice(0, 10) : "",
    clientLocation: initial.clientLocation ?? "",
    eventLocation: initial.eventLocation ?? "",
  });
  const [garments, setGarments] = useState<GarmentOption[]>([]);
  const [newGarment, setNewGarment] = useState("");
  const [saving, setSaving] = useState(false);

  const loadGarments = useCallback(async () => {
    const r = await fetch("/api/bespoke/garment-types");
    if (r.ok) setGarments(((await r.json()) as { items: GarmentOption[] }).items);
  }, []);
  useEffect(() => {
    void loadGarments();
  }, [loadGarments]);

  async function addGarment() {
    if (!newGarment.trim()) return;
    const r = await fetch("/api/bespoke/garment-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newGarment.trim() }),
    });
    const j = (await r.json().catch(() => ({}))) as { item?: GarmentOption; error?: string };
    if (!r.ok || !j.item) return toast.error(j.error ?? "Could not add that type");
    await loadGarments();
    setForm((f) => ({ ...f, garmentTypeId: j.item!.id }));
    setNewGarment("");
  }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch(`/api/bespoke/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          garmentTypeId: form.garmentTypeId || null,
          occasionDetails: form.occasionDetails,
          eventDate: form.eventDate || null,
          clientLocation: form.clientLocation,
          eventLocation: form.eventLocation,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Could not save");
      toast.success("Saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const garmentLabel = garments.find((g) => g.id === form.garmentTypeId)?.label;
  if (!canEdit) {
    return (
      <section className="card-surface p-6">
        <h2 className={H2}>The commission</h2>
        <dl className="mt-3 space-y-1 font-sans text-sm">
          <div><dt className="inline text-text-light">Garment: </dt><dd className="inline">{garmentLabel ?? "—"}</dd></div>
          <div><dt className="inline text-text-light">Her event: </dt><dd className="inline">{form.eventDate ? formatDate(form.eventDate, "d MMM yyyy") : "—"}{form.eventLocation ? `, ${form.eventLocation}` : ""}</dd></div>
          <div><dt className="inline text-text-light">She lives in: </dt><dd className="inline">{form.clientLocation || "—"}</dd></div>
        </dl>
      </section>
    );
  }

  return (
    <section className="card-surface p-6">
      <h2 className={H2}>The commission</h2>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="mb-1 block font-sans text-xs text-text-mid">
            Title — leave empty to read “{composedTitle}”
          </span>
          <input className={FIELD} value={form.title} maxLength={160} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </label>
        <label className="block">
          <span className="mb-1 block font-sans text-xs text-text-mid">The occasion, in her words</span>
          <input className={FIELD} value={form.occasionDetails} onChange={(e) => setForm((f) => ({ ...f, occasionDetails: e.target.value }))} />
        </label>
        <div>
          <span className="mb-1 block font-sans text-xs text-text-mid">What we are making</span>
          <div className="flex flex-wrap gap-2">
            <select className={`${FIELD} min-w-[12rem] flex-1`} value={form.garmentTypeId} onChange={(e) => setForm((f) => ({ ...f, garmentTypeId: e.target.value }))}>
              <option value="">Not set</option>
              {garments.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
            <input className={`${FIELD} w-40 flex-none`} placeholder="Another type…" value={newGarment} onChange={(e) => setNewGarment(e.target.value)} />
            <Button size="sm" variant="ghost" onClick={() => void addGarment()} disabled={!newGarment.trim()}>Add</Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block font-sans text-xs text-text-mid">Her event (not the delivery date)</span>
            <input type="date" className={FIELD} value={form.eventDate} onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block font-sans text-xs text-text-mid">Event place</span>
            <input className={FIELD} value={form.eventLocation} onChange={(e) => setForm((f) => ({ ...f, eventLocation: e.target.value }))} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block font-sans text-xs text-text-mid">Where she lives</span>
          <input className={FIELD} value={form.clientLocation} onChange={(e) => setForm((f) => ({ ...f, clientLocation: e.target.value }))} />
        </label>
        <Button size="sm" loading={saving} onClick={() => void save()}>Save</Button>
      </div>
    </section>
  );
}

/* ── BD3/BD4: beads needed, fabric type ───────────────────────────────────── */

type StaffOption = { userId: string; name: string };

export function SpecificationPanel({
  orderId,
  mayIssue,
  staffList,
  actorUserId,
  archived,
}: {
  orderId: string;
  /** House or store: may take an item out of the store book. */
  mayIssue: boolean;
  staffList: StaffOption[];
  actorUserId: string | null;
  archived: boolean;
}) {
  const [rows, setRows] = useState<MaterialRow[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [costHidden, setCostHidden] = useState(true);
  const [storeItems, setStoreItems] = useState<{ id: string; name: string; unit: string }[]>([]);
  const [form, setForm] = useState({
    kind: "BEADS" as MaterialKind,
    name: "",
    quantity: "",
    notes: "",
    unitCost: "",
    storeItemId: "",
    takenById: "",
    approvedById: "",
  });
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/bespoke/${orderId}/materials`);
    if (!r.ok) return setRows([]);
    const j = (await r.json()) as { items: MaterialRow[]; canEdit: boolean; costHidden: boolean };
    setRows(j.items);
    setCanEdit(j.canEdit);
    setCostHidden(j.costHidden);
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!mayIssue) return;
    void fetch("/api/admin/store/items")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items?: { id: string; name: string; unit: string }[] } | null) => d?.items && setStoreItems(d.items))
      .catch(() => undefined);
  }, [mayIssue]);

  async function addPicture(file: File) {
    setBusy(true);
    try {
      const url = await uploadAdminAsset(file, "bespoke-specification");
      setImages((prev) => [...prev, url]);
    } catch {
      toast.error("Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    setBusy(true);
    try {
      const r = await fetch(`/api/bespoke/${orderId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          unitCost: form.unitCost || null,
          storeItemId: form.storeItemId || null,
          takenById: form.takenById || actorUserId,
          approvedById: form.approvedById || null,
          images,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Could not add");
      toast.success(form.storeItemId ? "Issued from the store" : "Added to the specification");
      setForm((f) => ({ ...f, name: "", quantity: "", notes: "", unitCost: "", storeItemId: "" }));
      setImages([]);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add");
    } finally {
      setBusy(false);
    }
  }

  const split = splitSpecification(rows ?? []);
  const list = (items: MaterialRow[], empty: string) =>
    items.length === 0 ? (
      <p className="mt-1 font-sans text-sm text-text-mid">{empty}</p>
    ) : (
      <ul className="mt-2 space-y-3">
        {items.map((m) => (
          <li key={m.id} className="font-sans text-sm">
            <p className="text-ink">
              <span className="font-medium">{m.name}</span>
              {m.quantity ? ` · ${m.quantity}` : ""}
              {m.kind && m.kind !== "BEADS" && m.kind !== "FABRIC" ? ` · ${m.kindLabel}` : ""}
              {m.issued ? <span className="ml-2 text-10px uppercase tracking-wide text-text-light">Issued</span> : null}
              {!costHidden && m.totalCost != null ? <span className="ml-2 text-text-mid">{formatNGN(m.totalCost)}</span> : null}
            </p>
            {m.notes ? <p className="text-text-mid">{m.notes}</p> : null}
            {m.images.length ? (
              <div className="mt-1 flex flex-wrap gap-2">
                {m.images.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="block h-16 w-16 overflow-hidden bg-sand/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    );

  return (
    <section className="card-surface p-6">
      <h2 className={H2}>Beads needed</h2>
      {rows === null ? <p className="mt-2 font-sans text-sm text-text-light">Loading…</p> : list(split.beads, "No beads specified yet.")}
      <h2 className={`${H2} mt-6`}>Fabric type</h2>
      {rows === null ? null : list(split.fabric, "No fabric specified yet.")}
      {costHidden ? (
        <p className="mt-4 font-sans text-xs text-text-light">What these cost is kept for the store and cost of production.</p>
      ) : null}

      {canEdit && !archived ? (
        <div className="mt-5 space-y-2 border-t border-sand pt-4">
          <div className="flex flex-wrap gap-2">
            <select className={`${FIELD} w-auto`} value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as MaterialKind }))}>
              {MATERIAL_KINDS.map((k) => (
                <option key={k} value={k}>{MATERIAL_KIND_LABELS[k]}</option>
              ))}
            </select>
            {mayIssue ? (
              <select
                className={`${FIELD} min-w-[12rem] flex-1`}
                value={form.storeItemId}
                onChange={(e) => {
                  const picked = storeItems.find((s) => s.id === e.target.value);
                  setForm((f) => ({ ...f, storeItemId: e.target.value, name: picked ? picked.name : f.name }));
                }}
              >
                <option value="">Not from the store</option>
                {storeItems.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} · {s.unit}</option>
                ))}
              </select>
            ) : null}
          </div>
          <input className={FIELD} placeholder="What — e.g. crystal beads, broken beads, duchess satin" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input className={FIELD} placeholder="How much" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
          <textarea className={FIELD} rows={2} placeholder="Pattern, placement, colour…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          {!costHidden ? (
            <input className={FIELD} type="number" placeholder="Unit cost (₦)" value={form.unitCost} onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))} />
          ) : null}
          {form.storeItemId ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <select className={FIELD} value={form.takenById} onChange={(e) => setForm((f) => ({ ...f, takenById: e.target.value }))}>
                <option value="">Who is taking it…</option>
                {staffList.map((s) => <option key={s.userId} value={s.userId}>{s.name}</option>)}
              </select>
              <select className={FIELD} value={form.approvedById} onChange={(e) => setForm((f) => ({ ...f, approvedById: e.target.value }))}>
                <option value="">Supervisor who approved…</option>
                {staffList.map((s) => <option key={`ap-${s.userId}`} value={s.userId}>{s.name}</option>)}
              </select>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer font-sans text-xs">
              <span className="inline-flex rounded border border-sand px-3 py-2">{busy ? "Working…" : "Add a picture"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void addPicture(f); e.target.value = ""; }} />
            </label>
            {images.length ? <span className="font-sans text-xs text-text-mid">{images.length} picture(s)</span> : null}
            <Button size="sm" variant="secondary" loading={busy} onClick={() => void add()} disabled={!form.name.trim() && !form.storeItemId}>
              {form.storeItemId ? "Issue from store" : "Add"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ── BD6: measurements for this commission ─────────────────────────────────── */

export function CommissionMeasurementsCard({
  orderId,
  clientId,
  clientName,
  compact = false,
  title = "Measurements for this commission",
  onSaved,
}: {
  orderId: string;
  clientId: string | null;
  clientName: string;
  /** Inside another card, e.g. the client file. */
  compact?: boolean;
  title?: string;
  onSaved?: () => void;
}) {
  const [state, setState] = useState<CommissionMeasurements | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/bespoke/${orderId}/measurements`);
    if (r.ok) setState(((await r.json()) as { item: CommissionMeasurements }).item);
  }, [orderId]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!state) return null;

  const caption =
    state.source === "commission"
      ? `Taken for this commission${state.takenAt ? ` on ${formatDate(state.takenAt, "d MMM yyyy")}` : ""}.`
      : state.source === "client"
        ? `Not yet taken for this commission. Showing her last set${state.takenAt ? `, from ${formatDate(state.takenAt, "d MMM yyyy")}` : ""} — check before cutting.`
        : "None on record yet.";

  return (
    <ClientMeasurementsPanel
      key={`${state.source}-${state.takenAt ?? ""}`}
      clientId={clientId ?? orderId}
      clientName={clientName}
      initial={state.data}
      title={title}
      compact={compact}
      caption={<span className={state.source === "client" ? "text-warning" : undefined}>{caption}</span>}
      saveUrl={`/api/bespoke/${orderId}/measurements`}
      savedMessage="Saved to this commission and to her latest set"
      onSaved={() => {
        void load();
        onSaved?.();
      }}
    />
  );
}

/* ── BD4: cost of production ──────────────────────────────────────────────── */

type AssignmentOption = { id: string; role: string; name: string };

export function CostPanel({
  orderId,
  assignments,
  canDraftLabour,
}: {
  orderId: string;
  assignments: AssignmentOption[];
  /** `production.cost`: sees labour and may draft a sheet. */
  canDraftLabour: boolean;
}) {
  const [cost, setCost] = useState<CommissionCost | null>(null);
  const [fees, setFees] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/bespoke/${orderId}/cost`);
    if (r.ok) setCost(((await r.json()) as { item: CommissionCost }).item);
  }, [orderId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function draftSheet() {
    const labour = assignments
      .filter((a) => fees[a.id]?.trim())
      .map((a) => ({ assignmentId: a.id, role: a.role, amountNGN: Number(fees[a.id]) }));
    if (!labour.length) return toast.error("Enter at least one fee.");
    setSaving(true);
    try {
      const r = await fetch("/api/admin/store/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bespokeOrderId: orderId, labour, lines: [] }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Could not draft the sheet");
      toast.success("Cost sheet drafted — approve it under Store → Costs");
      setFees({});
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not draft the sheet");
    } finally {
      setSaving(false);
    }
  }

  if (!cost) return null;
  return (
    <section className="card-surface p-6">
      <h2 className={H2}>Cost of production</h2>
      <p className="mt-1 font-sans text-xs text-text-light">Never shown to the client.</p>
      <dl className="mt-3 space-y-1 font-sans text-sm">
        <div className="flex justify-between">
          <dt>Materials taken</dt>
          <dd>{formatNGN(cost.materials.totalNGN)}</dd>
        </div>
        {cost.materials.unpriced ? (
          <p className="text-xs text-warning">{cost.materials.unpriced} material(s) have no cost recorded yet.</p>
        ) : null}
        {cost.sheet ? (
          <div className="flex justify-between text-text-mid">
            <dt>Sheet estimate for materials ({cost.sheet.status.toLowerCase()})</dt>
            <dd>{formatNGN(cost.sheet.materialEstimateNGN)}</dd>
          </div>
        ) : null}
        {cost.sheet?.labour ? (
          <>
            {cost.sheet.labour.map((l) => (
              <div key={l.id} className="flex justify-between">
                <dt>{l.person ?? l.role.toLowerCase()} · {l.role.toLowerCase().replace(/_/g, " ")}</dt>
                <dd>{formatNGN(l.amountNGN)}</dd>
              </div>
            ))}
            <div className="flex justify-between">
              <dt>Labour</dt>
              <dd>{formatNGN(cost.sheet.labourNGN ?? 0)}</dd>
            </div>
          </>
        ) : null}
        {cost.costOfProductionNGN != null ? (
          <div className="flex justify-between border-t border-sand pt-1 font-medium text-ink">
            <dt>Cost of production</dt>
            <dd>{formatNGN(cost.costOfProductionNGN)}</dd>
          </div>
        ) : null}
        {cost.agreedPriceNGN != null ? (
          <>
            <div className="flex justify-between">
              <dt>Price agreed</dt>
              <dd>{formatNGN(cost.agreedPriceNGN)}</dd>
            </div>
            <div className="flex justify-between font-medium text-nut">
              <dt>Left after cost</dt>
              <dd>{formatNGN(cost.marginNGN ?? 0)}</dd>
            </div>
          </>
        ) : null}
      </dl>
      {canDraftLabour && assignments.length ? (
        <div className="mt-4 space-y-2 border-t border-sand pt-4">
          <p className="font-sans text-xs text-text-mid">Draft a cost sheet with each person’s fee:</p>
          {assignments.map((a) => (
            <label key={a.id} className="flex items-center justify-between gap-3 font-sans text-sm">
              <span>{a.name} · {a.role.toLowerCase().replace(/_/g, " ")}</span>
              <input
                type="number"
                min={0}
                placeholder="₦"
                className="w-32 rounded border border-sand px-2 py-1.5 text-right"
                value={fees[a.id] ?? ""}
                onChange={(e) => setFees((f) => ({ ...f, [a.id]: e.target.value }))}
              />
            </label>
          ))}
          <Button size="sm" variant="secondary" loading={saving} onClick={() => void draftSheet()}>Draft sheet</Button>
        </div>
      ) : null}
    </section>
  );
}
