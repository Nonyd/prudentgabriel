"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";

/**
 * Slice BC2 + BC3 on the commission: what the gown is (ticked from the house
 * library, with notes) and the expected delivery date. Managers edit; the
 * workroom reads.
 */

type Feature = { id: string; key: string; label: string; group: string | null; archivedAt: string | null };
type SpecRow = { featureId: string; key: string; label: string; group: string | null; note: string | null };

export function CommissionSpecPanel({
  orderId,
  initialSpec,
  initialDeliveryDate,
  canEdit,
}: {
  orderId: string;
  initialSpec: SpecRow[];
  initialDeliveryDate: string | Date | null;
  canEdit: boolean;
}) {
  const [spec, setSpec] = useState<SpecRow[]>(initialSpec);
  const [editing, setEditing] = useState(false);
  const [library, setLibrary] = useState<Feature[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [delivery, setDelivery] = useState<string>(() =>
    initialDeliveryDate ? new Date(initialDeliveryDate).toISOString().slice(0, 10) : "",
  );
  const [savedDelivery, setSavedDelivery] = useState(delivery);

  useEffect(() => {
    if (!editing || library) return;
    void fetch("/api/bespoke/construction-features?archived=1")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: Feature[] }) => setLibrary(d.items));
  }, [editing, library]);

  function startEdit() {
    setDraft(Object.fromEntries(spec.map((s) => [s.featureId, s.note ?? ""])));
    setEditing(true);
  }

  const groups = useMemo(() => {
    const ticked = new Set(Object.keys(draft));
    const visible = (library ?? []).filter((f) => !f.archivedAt || ticked.has(f.id));
    const map = new Map<string, Feature[]>();
    for (const f of visible) {
      const g = f.group ?? "Other";
      map.set(g, [...(map.get(g) ?? []), f]);
    }
    return Array.from(map.entries());
  }, [library, draft]);

  function toggle(id: string) {
    setDraft((d) => {
      const next = { ...d };
      if (id in next) delete next[id];
      else next[id] = "";
      return next;
    });
  }

  async function addFeature() {
    const label = newLabel.trim();
    if (!label) return;
    const res = await fetch("/api/bespoke/construction-features", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const data = (await res.json().catch(() => ({}))) as { item?: Feature; error?: string };
    if (!res.ok || !data.item) {
      toast.error(data.error ?? "Could not add the feature");
      return;
    }
    setLibrary((l) => [...(l ?? []), data.item!]);
    setDraft((d) => ({ ...d, [data.item!.id]: "" }));
    setNewLabel("");
    toast.success(`${data.item.label} added to the house library`);
  }

  async function saveSpec() {
    setSaving(true);
    try {
      const res = await fetch(`/api/bespoke/${orderId}/specification`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: Object.entries(draft).map(([featureId, note]) => ({ featureId, note })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { items?: SpecRow[]; error?: string };
      if (!res.ok || !data.items) {
        toast.error(data.error ?? "Could not save the specification");
        return;
      }
      setSpec(data.items);
      setEditing(false);
      toast.success("Specification saved");
    } finally {
      setSaving(false);
    }
  }

  async function saveDelivery() {
    const res = await fetch(`/api/bespoke/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryDate: delivery || null }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(data.error ?? "Could not save the delivery date");
      return;
    }
    setSavedDelivery(delivery);
    toast.success(delivery ? "Delivery date saved" : "Delivery date cleared");
  }

  return (
    <section className="card-surface p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-text-light">The gown</h2>
        {canEdit && !editing ? (
          <button type="button" className="font-sans text-xs text-nut underline" onClick={startEdit}>
            Edit
          </button>
        ) : null}
      </div>

      {!editing ? (
        spec.length === 0 ? (
          <p className="mt-3 font-sans text-sm text-text-light">No specification ticked yet.</p>
        ) : (
          <ul className="mt-3 space-y-1 font-sans text-sm">
            {spec.map((s) => (
              <li key={s.featureId}>
                <span className="text-ink">{s.label}</span>
                {s.note ? <span className="text-text-mid"> — {s.note}</span> : null}
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="mt-3 space-y-4">
          {!library ? <p className="font-sans text-sm text-text-mid">Loading the library…</p> : null}
          {groups.map(([group, features]) => (
            <div key={group}>
              <p className="font-sans text-[10px] uppercase tracking-wide text-text-light">{group}</p>
              <ul className="mt-1 space-y-2">
                {features.map((f) => {
                  const on = f.id in draft;
                  return (
                    <li key={f.id} className="font-sans text-sm">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={on} onChange={() => toggle(f.id)} />
                        <span>
                          {f.label}
                          {f.archivedAt ? <span className="text-text-light"> (retired)</span> : null}
                        </span>
                      </label>
                      {on ? (
                        <input
                          type="text"
                          value={draft[f.id] ?? ""}
                          maxLength={400}
                          placeholder="Note (optional)"
                          onChange={(e) => setDraft((d) => ({ ...d, [f.id]: e.target.value }))}
                          className="ml-6 mt-1 w-[calc(100%-1.5rem)] rounded border border-sand px-2 py-1 text-sm"
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Add a feature to the house library"
              className="min-w-0 flex-1 rounded border border-sand px-2 py-1 font-sans text-sm"
            />
            <Button size="sm" variant="ghost" onClick={() => void addFeature()}>
              Add
            </Button>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={() => void saveSpec()}>
              Save
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-sand pt-4">
        <p className="font-sans text-xs font-semibold uppercase tracking-wider text-text-light">Expected delivery</p>
        {canEdit ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="date"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
              className="rounded border border-sand px-2 py-1 font-sans text-sm"
            />
            {delivery !== savedDelivery ? (
              <Button size="sm" variant="secondary" onClick={() => void saveDelivery()}>
                Save
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 font-sans text-sm text-ink">{savedDelivery ? formatDate(savedDelivery) : "Not set"}</p>
        )}
      </div>
    </section>
  );
}
