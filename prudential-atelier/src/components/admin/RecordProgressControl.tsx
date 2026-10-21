"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { BespokeStage } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/bespoke-stages";

/**
 * Admins: move a commission forward to where the work really is, for progress made
 * outside the app (POST /api/bespoke/:id/record-progress). The stages in between are
 * recorded as done, with an optional date and note each; Design Approval and Final
 * Fitting as approved in person. Nothing is emailed. Moving back is "Revert stage".
 */

const IN_PERSON = new Set<string>(["DESIGN_APPROVAL", "FINAL_FITTING"]);
const inputCls = "mt-1 w-full rounded border border-sand px-3 py-2 font-sans text-sm";

export function RecordProgressControl<T>({
  orderId,
  currentStage,
  noEmail,
  onRecorded,
}: {
  orderId: string;
  currentStage: BespokeStage;
  /** Her email is a placeholder: approval links can never reach her. */
  noEmail: boolean;
  onRecorded: (item: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<BespokeStage | "">("");
  const [reason, setReason] = useState(noEmail ? "She has no email; done in person." : "");
  const [stages, setStages] = useState<Partial<Record<BespokeStage, { note: string; doneOn: string }>>>({});
  const [saving, setSaving] = useState(false);

  const from = STAGE_ORDER.indexOf(currentStage);
  const later = STAGE_ORDER.slice(from + 1);
  const between = target ? STAGE_ORDER.slice(from, STAGE_ORDER.indexOf(target)) : [];
  const today = new Date().toISOString().slice(0, 10);

  if (currentStage === ("DELIVERY" as BespokeStage) || later.length === 0) return null;

  async function save() {
    if (!target || reason.trim().length < 3) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bespoke/${orderId}/record-progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStage: target, reason, stages: Object.fromEntries(between.map((s) => [s, stages[s] ?? {}])) }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; item?: T };
      if (!res.ok) throw new Error(j.error ?? "Could not record the progress");
      if (j.item) onRecorded(j.item);
      toast.success(`Now at ${STAGE_LABELS[target]}`);
      setOpen(false);
      setTarget("");
      setStages({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the progress");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Record progress
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Record progress made outside the app">
        <p className="font-sans text-sm leading-relaxed text-text-mid">
          Choose where the work is now. The stages in between are recorded as done under your name, with no photos or client link needed.
          {noEmail ? " She has no email, so approvals she gave in person are recorded here." : ""} Nothing is emailed to her.
        </p>
        <label className="mt-4 block font-sans text-xs font-semibold uppercase tracking-[0.08em] text-text-mid">
          She is now at
          <select value={target} onChange={(e) => setTarget(e.target.value as BespokeStage | "")} className={inputCls}>
            <option value="">Choose a stage…</option>
            {later.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        {between.length ? (
          <div className="mt-4 max-h-[40vh] space-y-3 overflow-y-auto pr-1">
            <p className="font-sans text-11px font-semibold uppercase tracking-[0.08em] text-text-light">Recorded as done</p>
            {between.map((s) => {
              const row = stages[s] ?? { note: "", doneOn: "" };
              return (
                <div key={s} className="rounded-sm border border-sand p-3">
                  <p className="font-sans text-sm font-semibold text-ink">{STAGE_LABELS[s]}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[150px_1fr]">
                    <input
                      type="date"
                      max={today}
                      aria-label={`${STAGE_LABELS[s]} done on`}
                      className={inputCls}
                      value={row.doneOn}
                      onChange={(e) => setStages((x) => ({ ...x, [s]: { ...row, doneOn: e.target.value } }))}
                    />
                    <input
                      aria-label={`${STAGE_LABELS[s]} note`}
                      placeholder={IN_PERSON.has(s) ? "Approved in person." : "Completed."}
                      className={inputCls}
                      value={row.note}
                      onChange={(e) => setStages((x) => ({ ...x, [s]: { ...row, note: e.target.value } }))}
                    />
                  </div>
                  {IN_PERSON.has(s) ? <p className="mt-1 font-sans text-xs text-text-mid">Recorded as her approval given in person.</p> : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why this is recorded by hand (required, kept in the activity log)"
          rows={2}
          className={`${inputCls} mt-4`}
        />
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button loading={saving} disabled={!target || reason.trim().length < 3} onClick={() => void save()}>
            Record progress
          </Button>
        </div>
      </Modal>
    </>
  );
}
