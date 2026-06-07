"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AdminImageUrlField } from "@/components/admin/AdminImageUrlField";

type LogoRow = { key: string; value: string; label: string };

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

export function LogoSettingsCard({
  logoDark,
  logoWhite,
  onSaved,
}: {
  logoDark: LogoRow;
  logoWhite: LogoRow;
  onSaved: () => void;
}) {
  const [darkUrl, setDarkUrl] = useState(logoDark.value);
  const [whiteUrl, setWhiteUrl] = useState(logoWhite.value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDarkUrl(logoDark.value);
    setWhiteUrl(logoWhite.value);
  }, [logoDark.value, logoWhite.value]);

  const save = async () => {
    setSaving(true);
    try {
      await patchLogos([
        { key: "logo_dark", value: darkUrl },
        { key: "logo_white", value: whiteUrl },
      ]);
      toast.success("Logos saved ✓");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-sm border border-sand bg-canvas p-6">
      <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-[#6B6B68]">
        Brand logos
      </h2>
      <p className="mt-2 font-body text-xs text-[#6B6B68]">
        Upload dark and light logo variants for Cloudinary. Dark logo appears on ivory backgrounds; white logo on chocolate backgrounds.
      </p>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div>
          <AdminImageUrlField
            label="Logo (Light theme)"
            value={darkUrl}
            onChange={setDarkUrl}
            folder="prudent-gabriel/logos"
          />
          {darkUrl ? (
            <div className="mt-4 flex items-center justify-center rounded-sm border border-sand bg-[var(--ivory)] p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={darkUrl} alt="Dark logo preview" className="max-h-16 w-auto object-contain" />
            </div>
          ) : null}
        </div>
        <div>
          <AdminImageUrlField
            label="Logo (Dark theme)"
            value={whiteUrl}
            onChange={setWhiteUrl}
            folder="prudent-gabriel/logos"
          />
          {whiteUrl ? (
            <div className="mt-4 flex items-center justify-center rounded-sm border border-sand bg-[var(--sidebar-bg)] p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={whiteUrl} alt="White logo preview" className="max-h-16 w-auto object-contain" />
            </div>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="mt-8 h-10 w-full bg-[#37392d] font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save logos"}
      </button>
    </div>
  );
}
