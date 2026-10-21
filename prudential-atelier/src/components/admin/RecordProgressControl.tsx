"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { BespokeStage } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { isCustomStep, leadStep, sortSteps, stepLabel, type PipelineStep } from "@/lib/atelier/pipeline";

/**
 * Admins: move a commission forward to where the work really is, for progress made
 * outside the app (POST /api/bespoke/:id/record-progress). The order's own steps in between are
 * recorded as done, with an optional date and note each; Design Approval and Final
 * Fitting as approved in person. Nothing is emailed. Moving back is "Revert stage".
 */

const IN_PERSON = new Set<string>(["DESIGN_APPROVAL", "FINAL_FITTING"]);
const inputCls = "mt-1 w-full rounded border border-sand px-3 py-2 font-sans text-sm";

export function RecordProgressControl<T>({
  orderId,
  steps,
  noEmail,
  onRecorded,
}: {
  orderId: string;
  /** This order's steps, in their order. */
  steps: PipelineStep[];
  /** Her email is a placeholder: approval links can never reach her. */
  noEmail: boolean;
  onRecorded: (item: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<BespokeStage | "">("");
  const [reason, setReason] = useState(noEmail ? "She has no email; done in person." : "");
  const [stages, setStages] = useState<Partial<Record<BespokeStage, { note: string; doneOn: string }>>>({});
  const [saving, setSaving] = useState(false);

  const sorted = sortSteps(steps);
  const isOpen = (s: PipelineStep) => s.status !== "DONE" && s.status !== "SKIPPED";
  const lead = leadStep(sorted);
  // Where she can be now: a built-in step after the lead one, not done or skipped.
  const later = lead ? sorted.filter((s) => s.position > lead.position && isOpen(s) && !isCustomStep(s)) : [];
  const targetStep = sorted.find((s) => s.stage === target);
  const between = targetStep ? sorted.filter((s) => s.position < targetStep.position && isOpen(s)) : [];
  const today = new Date().toISOString().slice(0, 10);

  if (!lead || lead.stage === ("DELIVERY" as BespokeStage) || later.length === 0) return null;

  async function save() {
    if (!target || reason.trim().length < 3) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bespoke/${orderId}/record-progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStage: target,
          reason,
          stages: Object.fromEntries(between.filter((s) => !isCustomStep(s)).map((s) => [s.stage, stages[s.stage] ?? {}])),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; item?: T };
      if (!res.ok) throw new Error(j.error ?? "Could not record the progress");
      if (j.item) onRecorded(j.item);
      toast.success(`Now at ${targetStep ? stepLabel(targetStep) : target}`);
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
              <option key={s.id} value={s.stage}>
                {stepLabel(s)}
              </option>
            ))}
          </select>
        </label>

        {between.length ? (
          <div className="mt-4 max-h-[40vh] space-y-3 overflow-y-auto pr-1">
            <p className="font-sans text-11px font-semibold uppercase tracking-[0.08em] text-text-light">Recorded as done</p>
            {between.map((step) => {
              const s = step.stage;
              const row = stages[s] ?? { note: "", doneOn: "" };
              if (isCustomStep(step)) {
                return (
                  <div key={step.id} className="rounded-sm border border-sand p-3">
                    <p className="font-sans text-sm font-semibold text-ink">{stepLabel(step)}</p>
                    <p className="mt-1 font-sans text-xs text-text-mid">Recorded as completed today.</p>
                  </div>
                );
              }
              return (
                <div key={step.id} className="rounded-sm border border-sand p-3">
                  <p className="font-sans text-sm font-semibold text-ink">{stepLabel(step)}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[150px_1fr]">
                    <input
                      type="date"
                      max={today}
                      aria-label={`${stepLabel(step)} done on`}
                      className={inputCls}
                      value={row.doneOn}
                      onChange={(e) => setStages((x) => ({ ...x, [s]: { ...row, doneOn: e.target.value } }))}
                    />
                    <input
                      aria-label={`${stepLabel(step)} note`}
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
