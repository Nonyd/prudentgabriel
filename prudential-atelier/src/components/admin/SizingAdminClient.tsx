"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type ChartRow = {
  id?: string;
  label: string;
  sortOrder: number;
  bustCm: number;
  waistCm: number;
  hipCm: number;
  lengthCm: number | null;
};

type Field = {
  id: string;
  key: string;
  label: string;
  helpText: string | null;
  minCm: number | null;
  maxCm: number | null;
  sortOrder: number;
};

export function SizingAdminClient() {
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [c, f] = await Promise.all([
      fetch("/api/admin/size-chart").then((r) => r.json()),
      fetch("/api/admin/measurement-fields").then((r) => r.json()),
    ]);
    setRows((c?.rows ?? []) as ChartRow[]);
    setFields((f?.items ?? []) as Field[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const saveChart = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/size-chart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rows.map((r, i) => ({
            label: r.label,
            sortOrder: i,
            bustCm: Number(r.bustCm),
            waistCm: Number(r.waistCm),
            hipCm: Number(r.hipCm),
            lengthCm: r.lengthCm == null ? null : Number(r.lengthCm),
          })),
        }),
      });
      if (!res.ok) throw new Error("Could not save chart");
      toast.success("House chart saved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const saveField = async (field: Field) => {
    const res = await fetch(`/api/admin/measurement-fields/${field.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: field.label,
        helpText: field.helpText,
        minCm: field.minCm,
        maxCm: field.maxCm,
        sortOrder: field.sortOrder,
      }),
    });
    if (!res.ok) toast.error("Could not save field");
    else toast.success("Field saved");
  };

  return (
    <div className="space-y-10">
      <section className="rounded-sm border border-sand bg-canvas p-6">
        <h2 className="font-display text-lg text-gold">House size chart</h2>
        <p className="mt-1 text-sm text-charcoal-mid">
          One scale for ready-to-wear. Stored in centimetres; the shop shows inches alongside.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[#A8A8A4]">
              <tr>
                <th className="pb-2">Size</th>
                <th className="pb-2">Bust cm</th>
                <th className="pb-2">Waist cm</th>
                <th className="pb-2">Hip cm</th>
                <th className="pb-2">Length cm</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id ?? i} className="border-t border-sand">
                  {(["label", "bustCm", "waistCm", "hipCm", "lengthCm"] as const).map((k) => (
                    <td key={k} className="py-2 pr-2">
                      <input
                        value={r[k] ?? ""}
                        onChange={(e) => {
                          const v = k === "label" ? e.target.value : e.target.value === "" ? null : Number(e.target.value);
                          setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));
                        }}
                        className="w-full border border-sand bg-canvas px-2 py-1 text-charcoal"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveChart()}
          className="mt-4 bg-olive px-4 py-2 text-xs text-white hover:bg-olive-hover disabled:opacity-50"
        >
          Save chart
        </button>
      </section>

      <section className="rounded-sm border border-sand bg-canvas p-6">
        <h2 className="font-display text-lg text-gold">Measurement fields</h2>
        <p className="mt-1 text-sm text-charcoal-mid">
          Tick these on each product. Help text is what the customer reads while measuring.
        </p>
        <ul className="mt-4 space-y-4">
          {fields.map((f) => (
            <li key={f.id} className="border-t border-sand pt-4">
              <p className="font-mono text-xs text-[#A8A8A4]">{f.key}</p>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <label className="text-xs uppercase text-[#A8A8A4]">
                  Label
                  <input
                    value={f.label}
                    onChange={(e) =>
                      setFields((prev) => prev.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))
                    }
                    className="mt-1 w-full border border-sand bg-canvas px-2 py-1 text-sm text-charcoal"
                  />
                </label>
                <label className="text-xs uppercase text-[#A8A8A4]">
                  Min–max cm
                  <span className="mt-1 flex gap-2">
                    <input
                      type="number"
                      value={f.minCm ?? ""}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((x) => (x.id === f.id ? { ...x, minCm: e.target.value === "" ? null : Number(e.target.value) } : x)),
                        )
                      }
                      className="w-full border border-sand bg-canvas px-2 py-1 text-sm text-charcoal"
                    />
                    <input
                      type="number"
                      value={f.maxCm ?? ""}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((x) => (x.id === f.id ? { ...x, maxCm: e.target.value === "" ? null : Number(e.target.value) } : x)),
                        )
                      }
                      className="w-full border border-sand bg-canvas px-2 py-1 text-sm text-charcoal"
                    />
                  </span>
                </label>
                <label className="text-xs uppercase text-[#A8A8A4] md:col-span-2">
                  Help text
                  <textarea
                    value={f.helpText ?? ""}
                    onChange={(e) =>
                      setFields((prev) => prev.map((x) => (x.id === f.id ? { ...x, helpText: e.target.value } : x)))
                    }
                    rows={2}
                    className="mt-1 w-full border border-sand bg-canvas px-2 py-1 text-sm text-charcoal"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void saveField(f)}
                className="mt-2 border border-sand px-3 py-1 text-xs text-gold hover:bg-gold/10"
              >
                Save field
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
