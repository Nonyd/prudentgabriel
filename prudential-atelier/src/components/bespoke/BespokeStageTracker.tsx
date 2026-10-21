import Image from "next/image";
import type { BespokeStage, StageUpdate } from "@prisma/client";
import { STAGE_DESCRIPTIONS, STAGE_ORDER, STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";
import type { ClientStep } from "@/lib/atelier/pipeline";
import { cn, formatDate } from "@/lib/utils";

type HistoryRow = Pick<StageUpdate, "stage" | "completedAt"> &
  Partial<Pick<StageUpdate, "notes" | "images" | "orderStageId">>;

type Props = {
  /** Her order's real steps (clientSteps): skipped ones left out, several can be in progress. */
  steps?: ClientStep[];
  /** Only for callers without steps: the thirteen in their fixed order, this one in progress. */
  currentStage: BespokeStage;
  stageHistory: HistoryRow[];
  compact?: boolean;
};

function daysAgo(date: Date | string): number {
  const diff = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

/** The thirteen in their fixed order, for an order read without its steps. */
function fixedSteps(currentStage: BespokeStage, history: HistoryRow[]): ClientStep[] {
  const done = new Set(history.map((h) => h.stage));
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  return STAGE_ORDER.map((stage, idx) => ({
    id: stage,
    stage,
    number: idx + 1,
    label: STAGE_SHORT_LABELS[stage],
    description: STAGE_DESCRIPTIONS[stage],
    status: done.has(stage) ? "DONE" : idx === currentIdx ? "ACTIVE" : "PENDING",
  }));
}

export function BespokeStageTracker({ steps, currentStage, stageHistory, compact }: Props) {
  const list = steps?.length ? steps : fixedSteps(currentStage, stageHistory);
  // History by step; rows from before steps (no orderStageId) match by stage.
  const byStep = new Map<string, HistoryRow>();
  for (const row of stageHistory) {
    const key = row.orderStageId ?? row.stage;
    byStep.set(key, row);
  }
  const historyFor = (s: ClientStep) => byStep.get(s.id) ?? (s.stage !== "CUSTOM" ? byStep.get(s.stage) : undefined);

  return (
    <ol
      className={cn(
        "space-y-0",
        compact ? "mt-2 rounded-sm border border-sand/60 bg-ivory p-4 md:p-5" : "card-surface p-6 md:p-8",
      )}
    >
        {list.map((step, idx) => {
          const history = step.status === "DONE" ? historyFor(step) : undefined;
          const isDone = step.status === "DONE";
          const isActive = step.status === "ACTIVE";
          const isPending = !isDone && !isActive;
          const stageNum = String(step.number).padStart(2, "0");

          return (
            <li key={step.id} className={cn("relative flex gap-5", compact ? "pb-6 last:pb-0" : "pb-10 last:pb-0")}>
              {idx < list.length - 1 ? (
                <span
                  className={cn(
                    "absolute left-[18px] top-9 h-[calc(100%-12px)] w-px -translate-x-1/2",
                    isDone ? "bg-lightbr" : "bg-sand",
                  )}
                />
              ) : null}

              <span className="w-6 shrink-0 pt-1 font-sans text-[11px] text-text-light">{stageNum}</span>

              <div
                className={cn(
                  "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2",
                  isDone && "border-lightbr bg-lightbr",
                  isActive && "animate-pulse border-nut bg-nut",
                  isPending && "border-sand bg-white",
                )}
              >
                {isDone ? (
                  <span className="text-xs font-bold text-white">✓</span>
                ) : (
                  <span className={cn("h-2 w-2 rounded-full", isActive ? "bg-cream" : "bg-transparent")} />
                )}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      "font-serif text-[18px]",
                      (isDone || isActive) && "text-choc",
                      isPending && "text-text-light",
                    )}
                  >
                    {step.label}
                  </p>
                  {isActive ? (
                    <span className="rounded-full bg-sand px-2.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-wide text-nut">
                      In progress
                    </span>
                  ) : null}
                </div>

                {(isDone || isActive) && !compact ? (
                  <p className="mt-2 font-body text-[13px] leading-relaxed text-text-mid">{step.description}</p>
                ) : null}

                {history ? (
                  <>
                    <p className="mt-2 font-sans text-[11px] text-text-light">
                      Completed · {formatDate(history.completedAt)}
                    </p>
                    {history.notes ? (
                      <p className="mt-2 line-clamp-3 font-body text-[13px] text-text-mid">{history.notes}</p>
                    ) : null}
                    {(history.images?.length ?? 0) > 0 && !compact ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(history.images ?? []).slice(0, 4).map((img) => (
                          <div key={img} className="relative h-12 w-12 overflow-hidden rounded border border-sand">
                            <Image src={img} alt="" fill className="object-cover" unoptimized />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {isActive ? (
                  <p className="mt-2 font-sans text-[11px] text-text-light">
                    Updated {daysAgo(stageHistory[stageHistory.length - 1]?.completedAt ?? new Date())} days ago
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
  );
}
