"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { SettingType } from "@prisma/client";
import { patchGroup } from "@/components/admin/AdminSettingsClient";

type Row = {
  key: string;
  value: string;
  label: string;
  type: SettingType;
  isPublic: boolean;
  sortOrder: number;
};

type InstagramField = {
  key: string;
  label: string;
  fallback: string;
  href: string;
};

const FIELDS: InstagramField[] = [
  {
    key: "social_instagram",
    label: "Main Instagram",
    fallback: "@the_prudentgabriel",
    href: "https://instagram.com/the_prudentgabriel",
  },
  {
    key: "social_instagram_atelier",
    label: "Atelier Instagram",
    fallback: "@prudential_atelier",
    href: "https://instagram.com/prudential_atelier",
  },
  {
    key: "social_instagram_bridal",
    label: "Bridal Instagram",
    fallback: "@prudential_bridal",
    href: "https://instagram.com/prudential_bridal",
  },
  {
    key: "social_instagram_kids",
    label: "Kids Instagram",
    fallback: "@prudential_kids",
    href: "https://instagram.com/prudential_kids",
  },
];

export function SocialSettingsForm({ rows, onSaved }: { rows: Row[]; onSaved: () => void }) {
  const rowMap = useMemo(() => {
    return rows.reduce<Record<string, Row>>((acc, row) => {
      acc[row.key] = row;
      return acc;
    }, {});
  }, [rows]);

  const [values, setValues] = useState<Record<string, string>>(() =>
    FIELDS.reduce<Record<string, string>>((acc, field) => {
      acc[field.key] = rowMap[field.key]?.value ?? field.fallback;
      return acc;
    }, {}),
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const updates = FIELDS.map((field) => ({ key: field.key, value: values[field.key] ?? field.fallback }));
      await patchGroup("SOCIAL", updates);
      toast.success("Social media saved ✓");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-sm border border-[#EBEBEA] bg-canvas p-6">
      <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-[#6B6B68]">Instagram Handles</h2>
      <div className="mt-6 space-y-5">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label className="font-body text-xs text-charcoal">{field.label}</label>
            <input
              type="text"
              className="mt-1.5 w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm"
              value={values[field.key] ?? field.fallback}
              onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
            />
            <a href={field.href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-olive underline">
              Open ↗
            </a>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-8 h-10 w-full bg-[#37392d] font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Social"}
      </button>
    </div>
  );
}
