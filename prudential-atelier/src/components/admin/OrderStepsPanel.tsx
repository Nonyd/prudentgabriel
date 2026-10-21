"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  canStartNow,
  isCustomStep,
  moveStep,
  skipBlockers,
  sortSteps,
  stepLabel,
  stepRequirement,
  UNSKIPPABLE_STAGES,
  visibleSteps,
  type PipelineStep,
} from "@/lib/atelier/pipeline";
import { cn } from "@/lib/utils";

/**
 * The commission's own steps, in their order. Holders of `bespoke.pipeline`
 * (Admins and atelier managers) can switch to "Edit steps": move a step, skip
 * it, bring it back, add a custom step, rename, remove a custom one, or start a
 * step alongside the ones under way. The buttons use the same rules as the API
 * (pipeline.ts), so a button that would be refused is disabled with the reason.
 */

export type PanelStep = PipelineStep & { skippedReason?: string | null };

type Assignment = {
  id: string;
  role: string;
  orderStageId?: string | null;
  staffProfile: { user: { name: string | null; email: string | null } };
};

type Dialog =
  | { kind: "skip"; step: PanelStep }
  | { kind: "rename"; step: PanelStep }
  | { kind: "add" }
  | null;

const inputCls = "mt-1 w-full rounded border border-sand px-3 py-2 font-sans text-sm";
const labelCls = "mt-4 block font-sans text-xs font-semibold uppercase tracking-[0.08em] text-text-mid";

export function OrderStepsPanel<T>({
  orderId,
  steps,
  assignments,
  canEdit,
  productionUnlocked,
  onChanged,
}: {
  orderId: string;
  steps: PanelStep[];
  assignments: Assignment[];
  /** Holds `bespoke.pipeline`, and the order is open (not archived or delivered). */
  canEdit: boolean;
  productionUnlocked: boolean;
  onChanged: (item: T) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [afterId, setAfterId] = useState("");
  const [needsNotes, setNeedsNotes] = useState(true);
  const [photos, setPhotos] = useState(0);
  const [needsApproval, setNeedsApproval] = useState(false);

  const sorted = sortSteps(steps);
  const numbers = new Map(visibleSteps(sorted).map((s) => [s.id, s.number]));
  const running = sorted.filter((s) => s.status === "ACTIVE").length;

  async function send(body: Record<string, unknown>, key: string, done?: string): Promise<boolean> {
    setBusy(key);
    try {
      const res = await fetch(`/api/bespoke/${orderId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; failures?: { message: string }[]; item?: T };
      if (!res.ok) throw new Error(j.failures?.map((f) => f.message).join(" · ") || j.error || "Could not change the steps");
      if (j.item) onChanged(j.item);
      if (done) toast.success(done);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change the steps");
      return false;
    } finally {
      setBusy(null);
    }
  }

  function openAdd() {
    const lastBeforeDelivery = sorted.filter((s) => s.stage !== "DELIVERY").at(-1);
    setName("");
    setDescription("");
    setAfterId(lastBeforeDelivery?.id ?? "");
    setNeedsNotes(true);
    setPhotos(0);
    setNeedsApproval(false);
    setDialog({ kind: "add" });
  }

  async function submitDialog() {
    if (!dialog) return;
    let ok = false;
    if (dialog.kind === "skip") {
      ok = await send({ action: "skip", stepId: dialog.step.id, reason }, "dialog", `${stepLabel(dialog.step)} skipped`);
    } else if (dialog.kind === "rename") {
      const custom = isCustomStep(dialog.step);
      ok = await send(
        {
          action: "edit",
          stepId: dialog.step.id,
          label: name,
          clientDescription: description,
          ...(custom ? { requiresNotes: needsNotes, minMediaCount: photos, requiresClientApproval: needsApproval } : {}),
        },
        "dialog",
        "Step saved",
      );
    } else {
      ok = await send(
        {
          action: "add",
          afterStepId: afterId,
          label: name,
          clientDescription: description,
          requiresNotes: needsNotes,
          minMediaCount: photos,
          requiresClientApproval: needsApproval,
        },
        "dialog",
        `${name.trim()} added`,
      );
    }
    if (ok) setDialog(null);
  }

  return (
    <section className="card-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-text-light">
          Production stages
          {running > 1 ? <span className="ml-2 normal-case tracking-normal text-nut">· {running} under way</span> : null}
        </h2>
        {canEdit ? (
          <div className="flex gap-2">
            {editing ? (
              <Button size="sm" variant="secondary" onClick={openAdd}>
                Add a step
              </Button>
            ) : null}
            <Button size="sm" variant={editing ? "primary" : "secondary"} onClick={() => setEditing((v) => !v)}>
              {editing ? "Done editing" : "Edit steps"}
            </Button>
          </div>
        ) : null}
      </div>
      {editing ? (
        <p className="mt-2 font-sans text-11px leading-relaxed text-text-light">
          The four intake steps stay first and Delivery stays last. Nothing is cut before Design Approval, and steps run
          side by side only once the deposit is confirmed.
        </p>
      ) : null}

      <ol className="mt-6 space-y-0">
        {sorted.map((step, idx) => {
          const done = step.status === "DONE";
          const active = step.status === "ACTIVE";
          const skipped = step.status === "SKIPPED";
          const number = numbers.get(step.id);
          const up = moveStep(sorted, step.id, "up");
          const down = moveStep(sorted, step.id, "down");
          const start = step.status === "PENDING" ? canStartNow({ step, steps: sorted, productionUnlocked }) : null;
          const skipWhy = skipBlockers(step, "reason").map((f) => f.message).join(" ");
          const people = assignments.filter((a) => a.orderStageId === step.id);
          const req = stepRequirement(step);
          return (
            <li key={step.id} className="flex gap-4 pb-6 last:pb-0">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-11px font-semibold",
                    done && "border-lightbr bg-lightbr text-cream",
                    active && "border-nut bg-nut text-cream animate-pulse",
                    skipped && "border-dashed border-sand bg-transparent text-text-light",
                    !done && !active && !skipped && "border-sand bg-bg-card text-text-light",
                  )}
                >
                  {skipped ? "–" : number}
                </div>
                {idx < sorted.length - 1 ? (
                  <div className={cn("w-0.5 flex-1 min-h-[24px] mt-1", done ? "bg-lightbr" : "bg-sand")} />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <p
                  className={cn(
                    "font-sans text-sm",
                    active && "font-semibold text-nut",
                    skipped && "text-text-light line-through",
                  )}
                >
                  {stepLabel(step)}
                  {isCustomStep(step) ? (
                    <span className="ml-2 rounded-full bg-sand/60 px-2 py-0.5 text-10px font-semibold uppercase tracking-wide text-text-mid no-underline">
                      Added
                    </span>
                  ) : null}
                  {active ? <span className="ml-2 text-11px font-normal text-nut">In progress</span> : null}
                </p>
                {skipped && step.skippedReason ? (
                  <p className="mt-1 font-sans text-11px text-text-light">Skipped: {step.skippedReason}</p>
                ) : null}
                {people.map((a) => (
                  <p key={a.id} className="mt-1 font-sans text-11px text-text-light">
                    {a.staffProfile.user.name ?? a.staffProfile.user.email}
                    {a.role ? ` · ${a.role}` : ""}
                  </p>
                ))}
                {editing && isCustomStep(step) ? (
                  <p className="mt-1 font-sans text-11px text-text-light">
                    {[
                      req.requiresNotes ? "notes" : null,
                      req.minMediaCount ? `${req.minMediaCount} photo${req.minMediaCount === 1 ? "" : "s"}` : null,
                      req.requiresClientApproval ? "client approval" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No requirements"}
                  </p>
                ) : null}
                {editing ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StepButton
                      label="↑"
                      aria={`Move ${stepLabel(step)} up`}
                      why={up.ok ? null : up.failures[0]?.message}
                      busy={busy === `${step.id}:up`}
                      onClick={() => void send({ action: "move", stepId: step.id, direction: "up" }, `${step.id}:up`)}
                    />
                    <StepButton
                      label="↓"
                      aria={`Move ${stepLabel(step)} down`}
                      why={down.ok ? null : down.failures[0]?.message}
                      busy={busy === `${step.id}:down`}
                      onClick={() => void send({ action: "move", stepId: step.id, direction: "down" }, `${step.id}:down`)}
                    />
                    {start ? (
                      <StepButton
                        label="Start now"
                        why={start.ok ? null : start.failures[0]?.message}
                        busy={busy === `${step.id}:start`}
                        onClick={() =>
                          void send({ action: "start", stepId: step.id }, `${step.id}:start`, `${stepLabel(step)} started`)
                        }
                      />
                    ) : null}
                    {skipped ? (
                      <StepButton
                        label="Bring back"
                        busy={busy === `${step.id}:unskip`}
                        onClick={() =>
                          void send({ action: "unskip", stepId: step.id }, `${step.id}:unskip`, `${stepLabel(step)} brought back`)
                        }
                      />
                    ) : !done && !UNSKIPPABLE_STAGES.has(step.stage) ? (
                      <StepButton
                        label="Skip"
                        why={skipWhy || null}
                        onClick={() => {
                          setReason("");
                          setDialog({ kind: "skip", step });
                        }}
                      />
                    ) : null}
                    <StepButton
                      label={isCustomStep(step) ? "Edit" : "Rename"}
                      onClick={() => {
                        setName(step.label ?? "");
                        setDescription(step.clientDescription ?? "");
                        setNeedsNotes(step.requiresNotes);
                        setPhotos(step.minMediaCount);
                        setNeedsApproval(step.requiresClientApproval);
                        setDialog({ kind: "rename", step });
                      }}
                    />
                    {isCustomStep(step) && !done ? (
                      <StepButton
                        label="Remove"
                        busy={busy === `${step.id}:remove`}
                        onClick={() => {
                          if (!window.confirm(`Remove ${stepLabel(step)} from this commission?`)) return;
                          void send({ action: "remove", stepId: step.id }, `${step.id}:remove`, `${stepLabel(step)} removed`);
                        }}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={
          dialog?.kind === "skip"
            ? `Skip ${stepLabel(dialog.step)}`
            : dialog?.kind === "rename"
              ? `${isCustomStep(dialog.step) ? "Edit" : "Rename"} ${stepLabel(dialog.step)}`
              : "Add a step to this commission"
        }
      >
        {dialog?.kind === "skip" ? (
          <>
            <p className="font-sans text-sm text-text-mid">
              The step is left off her tracking page. It can be brought back later. Kept in the activity log with your
              reason.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why this step is not needed (required)"
              rows={3}
              className={`${inputCls} mt-4`}
            />
          </>
        ) : (
          <>
            {dialog?.kind === "add" ? (
              <label className={labelCls}>
                Comes after
                <select value={afterId} onChange={(e) => setAfterId(e.target.value)} className={inputCls}>
                  {sorted
                    .filter((s) => s.stage !== "DELIVERY")
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {stepLabel(s)}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            <label className={labelCls}>
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder={dialog?.kind === "add" ? "Second fitting" : stepLabel(dialog?.step ?? { stage: "CUSTOM", label: null })}
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              What she reads on her tracking page
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={600}
                rows={2}
                className={inputCls}
              />
            </label>
            {dialog?.kind === "add" || (dialog?.kind === "rename" && isCustomStep(dialog.step)) ? (
              <fieldset className="mt-4 space-y-2 font-sans text-sm text-ink">
                <legend className="font-sans text-xs font-semibold uppercase tracking-[0.08em] text-text-mid">
                  To complete it
                </legend>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={needsNotes} onChange={(e) => setNeedsNotes(e.target.checked)} />
                  Notes for the client
                </label>
                <label className="flex items-center gap-2">
                  Photos needed
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={photos}
                    onChange={(e) => setPhotos(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
                    className="w-16 rounded border border-sand px-2 py-1 font-sans text-sm"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={needsApproval} onChange={(e) => setNeedsApproval(e.target.checked)} />
                  Her approval
                </label>
              </fieldset>
            ) : null}
          </>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button
            loading={busy === "dialog"}
            disabled={
              dialog?.kind === "skip"
                ? reason.trim().length < 3
                : dialog?.kind === "add"
                  ? !name.trim() || !afterId
                  : dialog?.kind === "rename" && isCustomStep(dialog.step)
                    ? !name.trim()
                    : false
            }
            onClick={() => void submitDialog()}
          >
            {dialog?.kind === "skip" ? "Skip step" : dialog?.kind === "add" ? "Add step" : "Save"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}

function StepButton({
  label,
  aria,
  why,
  busy,
  onClick,
}: {
  label: string;
  aria?: string;
  /** Why the house rules refuse it; the button is disabled and says so on hover. */
  why?: string | null;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={aria ?? label}
      title={why ?? undefined}
      disabled={Boolean(why) || busy}
      onClick={onClick}
      className={cn(
        "rounded border border-sand px-2 py-1 font-sans text-11px text-ink hover:border-nut hover:text-nut",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-sand disabled:hover:text-ink",
      )}
    >
      {busy ? "…" : label}
    </button>
  );
}
