"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AdminImageUrlField } from "@/components/admin/AdminImageUrlField";

type LogoRow = { key: string; value: string; label: string };

type BrandConfig = {
  title: string;
  darkKey: string;
  whiteKey: string;
  darkRow?: LogoRow;
  whiteRow?: LogoRow;
};

async function patchLogos(updates: { key: string; value: string }[]) {
  const res = await fetch("/api/admin/settings/APPEARANCE", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? "Save failed");
  }
}

function BrandLogoPair({
  brand,
  darkUrl,
  whiteUrl,
  onDarkChange,
  onWhiteChange,
}: {
  brand: BrandConfig;
  darkUrl: string;
  whiteUrl: string;
  onDarkChange: (v: string) => void;
  onWhiteChange: (v: string) => void;
}) {
  return (
    <div className="rounded-sm border border-[#EBEBEA] bg-canvas p-6">
      <h3 className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-[#6B6B68]">
        {brand.title}
      </h3>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <AdminImageUrlField
          label="Logo — Light Theme"
          value={darkUrl}
          onChange={onDarkChange}
          folder="prudent-gabriel/logos"
        />
        <AdminImageUrlField
          label="Logo — Dark Theme"
          value={whiteUrl}
          onChange={onWhiteChange}
          folder="prudent-gabriel/logos"
        />
      </div>
      {(darkUrl || whiteUrl) && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {darkUrl ? (
            <div className="flex items-center justify-center rounded-sm border border-[#EBEBEA] bg-[var(--ivory)] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={darkUrl} alt={`${brand.title} light preview`} className="max-h-12 w-auto object-contain" />
            </div>
          ) : null}
          {whiteUrl ? (
            <div className="flex items-center justify-center rounded-sm border border-[#EBEBEA] bg-[var(--sidebar-bg)] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={whiteUrl} alt={`${brand.title} dark preview`} className="max-h-12 w-auto object-contain" />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function SubBrandLogosSettingsCard({
  rows,
  onSaved,
}: {
  rows: LogoRow[];
  onSaved: () => void;
}) {
  const find = (key: string) => rows.find((r) => r.key === key);

  const brands: BrandConfig[] = [
    {
      title: "Main Brand",
      darkKey: "logo_dark",
      whiteKey: "logo_white",
      darkRow: find("logo_dark"),
      whiteRow: find("logo_white"),
    },
    {
      title: "Atelier",
      darkKey: "logo_atelier_dark",
      whiteKey: "logo_atelier_white",
      darkRow: find("logo_atelier_dark"),
      whiteRow: find("logo_atelier_white"),
    },
    {
      title: "Bridal",
      darkKey: "logo_bridal_dark",
      whiteKey: "logo_bridal_white",
      darkRow: find("logo_bridal_dark"),
      whiteRow: find("logo_bridal_white"),
    },
    {
      title: "Kids",
      darkKey: "logo_kids_dark",
      whiteKey: "logo_kids_white",
      darkRow: find("logo_kids_dark"),
      whiteRow: find("logo_kids_white"),
    },
  ];

  const [urls, setUrls] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const b of brands) {
      initial[b.darkKey] = b.darkRow?.value ?? "";
      initial[b.whiteKey] = b.whiteRow?.value ?? "";
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const b of brands) {
      next[b.darkKey] = b.darkRow?.value ?? "";
      next[b.whiteKey] = b.whiteRow?.value ?? "";
    }
    setUrls(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const save = async () => {
    setSaving(true);
    try {
      const updates = brands.flatMap((b) => [
        { key: b.darkKey, value: urls[b.darkKey] ?? "" },
        { key: b.whiteKey, value: urls[b.whiteKey] ?? "" },
      ]);
      await patchLogos(updates);
      toast.success("Logos saved ✓");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="font-body text-xs text-[#6B6B68]">
        If a sub-brand logo is not set, the main brand logo will be used on that section&apos;s pages.
      </p>
      {brands.map((brand) => (
        <BrandLogoPair
          key={brand.title}
          brand={brand}
          darkUrl={urls[brand.darkKey] ?? ""}
          whiteUrl={urls[brand.whiteKey] ?? ""}
          onDarkChange={(v) => setUrls((prev) => ({ ...prev, [brand.darkKey]: v }))}
          onWhiteChange={(v) => setUrls((prev) => ({ ...prev, [brand.whiteKey]: v }))}
        />
      ))}
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="h-10 w-full bg-[#37392d] font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save all logos"}
      </button>
    </div>
  );
}
