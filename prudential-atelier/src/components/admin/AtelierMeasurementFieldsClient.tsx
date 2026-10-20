"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AtelierMeasurementField } from "@/lib/atelier/measurement-fields-shared";

type Row = { key?: string; label: string; help: string; retired: boolean };

const STANDARD = [
  "Bust",
  "Waist",
  "Hips",
  "Shoulder",
  "Sleeve",
  "Dress length",
  "Thigh",
  "Inseam",
  "Neck",
  "Armhole",
];

function toRows(fields: AtelierMeasurementField[]): Row[] {
  return fields.map((f) => ({ key: f.key, label: f.label, help: f.help ?? "", retired: f.retired === true }));
}

/**
 * Atelier → Measurement fields. The ten standard measurements are fixed; the
 * house adds its own here, and they appear on every commission's and client's
 * measurement form. A field in use is retired, never deleted, so values already
 * taken keep their name.
 */
export function AtelierMeasurementFieldsClient() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/atelier/measurement-fields")
      .then((r) => r.json())
      .then((j: { fields?: AtelierMeasurementField[] }) => setRows(toRows(j.fields ?? [])))
      .catch(() => setRows([]));
  }, []);

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => (rs ? rs.map((r, n) => (n === i ? { ...r, ...patch } : r)) : rs));
  }

  function move(i: number, by: -1 | 1) {
    setRows((rs) => {
      if (!rs) return rs;
      const j = i + by;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  async function save() {
    if (!rows) return;
    if (rows.some((r) => !r.label.trim())) {
      toast.error("Every field needs a name");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/atelier/measurement-fields", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: rows.map((r) => ({
            key: r.key,
            label: r.label.trim(),
            help: r.help.trim() || undefined,
            retired: r.retired || undefined,
          })),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { fields?: AtelierMeasurementField[]; error?: string };
      if (!res.ok) {
        toast.error(j.error ?? "Could not save");
        return;
      }
      setRows(toRows(j.fields ?? []));
      toast.success("Measurement fields saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/bespoke"
          className="font-sans text-10px font-semibold uppercase tracking-[0.14em] text-text-light hover:text-nut"
        >
          ← Atelier pipeline
        </Link>
        <h1 className="mt-2 font-display text-2xl text-ink">Measurement fields</h1>
        <p className="mt-1 font-sans text-sm text-text-mid">
          Add the measurements the atelier takes beyond the standard ten. They appear on every commission&apos;s
          measurement form and on the client&apos;s saved measurements, in the same unit as the rest of the set.
        </p>
      </div>

      <section className="card-surface p-5">
        <h2 className="font-sans text-10px font-semibold uppercase tracking-[0.14em] text-text-light">
          Always taken
        </h2>
        <p className="mt-2 font-sans text-sm text-text-mid">{STANDARD.join(" · ")}</p>
      </section>

      <section className="card-surface space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-sans text-10px font-semibold uppercase tracking-[0.14em] text-text-light">
            Added by the house
          </h2>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!rows}
            onClick={() => setRows((rs) => [...(rs ?? []), { label: "", help: "", retired: false }])}
          >
            Add field
          </Button>
        </div>

        {!rows ? (
          <p className="font-sans text-sm text-text-mid">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="font-sans text-sm text-text-mid">None yet. Add one, such as Bicep, Wrist or Back length.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r, i) => (
              <li
                key={r.key ?? `new-${i}`}
                className={`rounded border border-sand/70 p-3 ${r.retired ? "opacity-60" : ""}`}
              >
                <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                  <label className="block">
                    <span className="mb-1 block font-sans text-xs text-text-mid">Name</span>
                    <input
                      value={r.label}
                      maxLength={60}
                      onChange={(e) => update(i, { label: e.target.value })}
                      placeholder="e.g. Bicep"
                      className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-sans text-xs text-text-mid">How to take it (optional)</span>
                    <input
                      value={r.help}
                      maxLength={200}
                      onChange={(e) => update(i, { help: e.target.value })}
                      placeholder="e.g. Around the fullest part of the upper arm"
                      className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
                    />
                  </label>
                  <div className="flex items-end gap-1">
                    <button
                      type="button"
                      aria-label={`Move ${r.label || "field"} up`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      className="rounded p-2 text-text-mid hover:bg-bg disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${r.label || "field"} down`}
                      disabled={i === rows.length - 1}
                      onClick={() => move(i, 1)}
                      className="rounded p-2 text-text-mid hover:bg-bg disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {r.key ? (
                    <label className="flex items-center gap-2 font-sans text-xs text-text-mid">
                      <input type="checkbox" checked={r.retired} onChange={(e) => update(i, { retired: e.target.checked })} />
                      Retired: no longer asked for (values already taken still show)
                    </label>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRows((rs) => (rs ? rs.filter((_, n) => n !== i) : rs))}
                      className="font-sans text-xs text-danger"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end border-t border-sand pt-4">
          <Button type="button" loading={saving} disabled={!rows} onClick={() => void save()}>
            Save fields
          </Button>
        </div>
      </section>
    </div>
  );
}
