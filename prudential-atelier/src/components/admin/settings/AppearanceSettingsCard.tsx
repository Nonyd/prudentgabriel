"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { SettingGroup, SettingType } from "@prisma/client";
import { AdminImageUrlField } from "@/components/admin/AdminImageUrlField";

type Row = {
  key: string;
  value: string;
  label: string;
  type: SettingType;
  isPublic: boolean;
  sortOrder: number;
};

async function patchGroup(group: SettingGroup, updates: { key: string; value: string }[]) {
  const res = await fetch(`/api/admin/settings/${group}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? "Save failed");
  }
  return res.json() as Promise<{ paymentKeysChanged?: boolean }>;
}

export function AppearanceSettingsCard({
  rows,
  onSaved,
}: {
  rows: Row[];
  onSaved: () => void;
}) {
  const [local, setLocal] = useState<Row[]>(rows);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal(rows);
  }, [rows]);

  const updateVal = (key: string, value: string) => {
    setLocal((prev) => prev.map((r) => (r.key === key ? { ...r, value } : r)));
  };

  const save = async () => {
    setSaving(true);
    try {
      const updates = local.map((r) => ({ key: r.key, value: r.value }));
      await patchGroup("APPEARANCE", updates);
      toast.success("Appearance saved ✓");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-sm border border-sand bg-canvas p-6">
      <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-[#6B6B68]">Site images</h2>
      <p className="mt-2 font-body text-xs text-[#6B6B68]">
        Replace static images across the site. Upload fills the URL automatically; you can still paste a CDN URL manually.
      </p>
      <div className="mt-6 space-y-6">
        {local.map((row) =>
          row.type === "IMAGE" ? (
            <AdminImageUrlField
              key={row.key}
              label={row.label}
              value={row.value}
              onChange={(v) => updateVal(row.key, v)}
              folder="prudent-gabriel/appearance"
            />
          ) : (
            <div key={row.key}>
              <label className="font-body text-xs text-charcoal">{row.label}</label>
              <input
                type="text"
                className="mt-1.5 w-full border border-sand px-3 py-2 font-body text-sm"
                value={row.value}
                onChange={(e) => updateVal(row.key, e.target.value)}
              />
            </div>
          ),
        )}
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="mt-8 h-10 w-full bg-[#37392d] font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save appearance"}
      </button>
    </div>
  );
}
