"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import toast from "react-hot-toast";
import type { SettingGroup, SettingType } from "@prisma/client";

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

function ImageSlotRow({
  row,
  onChange,
}: {
  row: Row;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const url = row.value.trim();
  const canPreview = url.length > 0;

  const pickFile = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "prudent-gabriel/appearance");
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !j.url) {
        throw new Error(j.error ?? "Upload failed");
      }
      onChange(j.url);
      toast.success("Image uploaded — URL filled in");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="font-body text-xs text-charcoal">{row.label}</label>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          className="min-w-0 flex-1 border border-[#EBEBEA] px-3 py-2 font-body text-sm"
          value={row.value}
          placeholder="Image URL"
          onChange={(e) => onChange(e.target.value)}
        />
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={pickFile}
            className="border border-[#37392d] bg-[#37392d] px-3 py-2 font-body text-[11px] font-medium uppercase tracking-wide text-white disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <Dialog.Root open={previewOpen} onOpenChange={setPreviewOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                disabled={!canPreview}
                className="border border-[#EBEBEA] px-3 py-2 font-body text-[11px] font-medium uppercase tracking-wide text-charcoal disabled:cursor-not-allowed disabled:opacity-40"
              >
                Preview
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/50" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] w-[min(90vw,320px)] -translate-x-1/2 -translate-y-1/2 border border-[#EBEBEA] bg-canvas p-5 shadow-lg">
                <Dialog.Title className="font-body text-sm font-medium text-charcoal">Preview</Dialog.Title>
                <div className="relative mx-auto mt-4 h-[200px] w-[200px] overflow-hidden bg-[#F5F5F3]">
                  {canPreview && (
                    <Image src={url} alt="" fill className="object-contain" sizes="200px" unoptimized />
                  )}
                </div>
                <Dialog.Close asChild>
                  <button type="button" className="mt-4 w-full border border-[#EBEBEA] py-2 font-body text-xs uppercase text-charcoal">
                    Close
                  </button>
                </Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </div>
  );
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
    <div className="rounded-sm border border-[#EBEBEA] bg-canvas p-6">
      <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-[#6B6B68]">Site images</h2>
      <p className="mt-2 font-body text-xs text-[#6B6B68]">
        Replace static images across the site. Upload fills the URL automatically; you can still paste a CDN URL manually.
      </p>
      <div className="mt-6 space-y-6">
        {local.map((row) =>
          row.type === "IMAGE" ? (
            <ImageSlotRow key={row.key} row={row} onChange={(v) => updateVal(row.key, v)} />
          ) : (
            <div key={row.key}>
              <label className="font-body text-xs text-charcoal">{row.label}</label>
              <input
                type="text"
                className="mt-1.5 w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm"
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
