"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import type { WorkdayItem } from "@/lib/atelier/work-log";
import { uploadAdminAsset } from "@/lib/admin-upload-xhr";

/**
 * Slice BD7 — the day's entry, one per commission she is on. The portal asks
 * from the set hour; it never locks her out. Filing again the same day
 * replaces that day's entry.
 */

type Workday = { day: string; promptHour: number; promptDue: boolean; missing: number; items: WorkdayItem[] };

const PROGRESS_STEPS = [0, 25, 50, 75, 100];

function EntryForm({ item, onFiled }: { item: WorkdayItem; onFiled: (w: Workday) => void }) {
  const [done, setDone] = useState(item.entry?.done ?? "");
  const [progress, setProgress] = useState(item.entry?.progress ?? 25);
  const [blocker, setBlocker] = useState(item.entry?.blocker ?? "");
  const [partDone, setPartDone] = useState(item.entry?.partDone ?? false);
  const [images, setImages] = useState<string[]>(item.entry?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function addPicture(file: File) {
    setUploading(true);
    try {
      // Same upload route, store and size limits as the house; the workroom folder.
      const url = await uploadAdminAsset(file, "bespoke-workroom");
      setImages((prev) => [...prev, url].slice(0, 6));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function file() {
    setSaving(true);
    try {
      const r = await fetch("/api/staff/work-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: item.assignmentId, done, progress, blocker, partDone, images }),
      });
      const j = (await r.json().catch(() => ({}))) as Workday & { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Could not file");
      toast.success("Filed for today");
      onFiled(j);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not file");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={done}
        onChange={(e) => setDone(e.target.value)}
        rows={2}
        placeholder="What did you do on it today?"
        className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
      />
      <div className="flex flex-wrap items-center gap-2 font-sans text-xs text-text-mid">
        How far it got:
        {PROGRESS_STEPS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setProgress(p)}
            aria-pressed={progress === p}
            className={`rounded-full border px-2.5 py-1 ${progress === p ? "border-choc bg-choc text-ivory" : "border-sand"}`}
          >
            {p}%
          </button>
        ))}
      </div>
      <input
        value={blocker}
        onChange={(e) => setBlocker(e.target.value)}
        placeholder="Anything in the way? (fabric, beads, a decision…)"
        className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer font-sans text-xs">
          <span className="inline-flex rounded border border-sand px-3 py-2">{uploading ? "Uploading…" : "Add a picture"}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={uploading || images.length >= 6}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void addPicture(file);
              e.target.value = "";
            }}
          />
        </label>
        {images.map((u) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={u} src={u} alt="" className="h-12 w-12 object-cover" />
        ))}
      </div>
      <label className="flex items-center gap-2 font-sans text-sm text-ink">
        <input type="checkbox" checked={partDone} onChange={(e) => setPartDone(e.target.checked)} />
        My part on this gown is finished
      </label>
      <Button size="sm" loading={saving} disabled={!done.trim()} onClick={() => void file()}>
        {item.entry ? "Update today's entry" : "File today's entry"}
      </Button>
    </div>
  );
}

export function EndOfDayCard() {
  const [data, setData] = useState<Workday | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/staff/work-log");
    if (r.ok) setData((await r.json()) as Workday);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!data || data.items.length === 0) return null;
  const due = data.promptDue && data.missing > 0;

  return (
    <section className={`staff-card p-4 md:p-5 ${due ? "border-2 border-choc" : ""}`}>
      <h2 className="font-sans text-10px font-semibold uppercase tracking-[0.14em] text-text-mid">End of day</h2>
      <p className="mt-1 font-sans text-sm text-ink">
        {data.missing === 0
          ? "Everything is filed for today. Thank you."
          : due
            ? `Please file today's work on ${data.missing} commission${data.missing === 1 ? "" : "s"} before you go.`
            : `From ${data.promptHour}:00, file what you did today on each commission.`}
      </p>
      <ul className="mt-3 divide-y divide-sand">
        {data.items.map((item) => (
          <li key={item.assignmentId} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href={`/staff/orders/${item.orderId}`} className="font-sans text-sm font-semibold text-choc hover:underline">
                {item.title}
              </Link>
              <span className="font-sans text-xs text-text-mid">
                {item.completedAt ? "Your part is done" : item.entry ? `Filed · ${item.entry.progress}%` : "Not filed yet"}
              </span>
            </div>
            {open === item.assignmentId ? (
              <EntryForm
                item={item}
                onFiled={(w) => {
                  setData(w);
                  setOpen(null);
                }}
              />
            ) : item.completedAt && !item.entry ? null : (
              <button type="button" className="mt-1 font-sans text-xs text-nut underline" onClick={() => setOpen(item.assignmentId)}>
                {item.entry ? "Change today's entry" : "File today's entry"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
