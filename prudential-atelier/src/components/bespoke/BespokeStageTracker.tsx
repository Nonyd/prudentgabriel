import Image from "next/image";
import type { BespokeStage, StageUpdate } from "@prisma/client";
import { STAGE_DESCRIPTIONS, STAGE_ORDER, STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";
import { cn, formatDate } from "@/lib/utils";

type Props = {
  currentStage: BespokeStage;
  stageHistory: StageUpdate[];
  compact?: boolean;
};

function daysAgo(date: Date): number {
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function BespokeStageTracker({ currentStage, stageHistory, compact }: Props) {
  const completedMap = new Map(stageHistory.map((s) => [s.stage, s]));
  const currentIdx = STAGE_ORDER.indexOf(currentStage);

  return (
    <ol className={cn("card-surface space-y-0 p-6 md:p-8", compact ? "mt-4" : "mt-0")}>
        {STAGE_ORDER.map((stage, idx) => {
          const history = completedMap.get(stage);
          const isDone = Boolean(history) || idx < currentIdx;
          const isActive = idx === currentIdx && !isDone;
          const isPending = idx > currentIdx && !isDone;
          const stageNum = String(idx + 1).padStart(2, "0");

          return (
            <li key={stage} className={cn("relative flex gap-5", compact ? "pb-6 last:pb-0" : "pb-10 last:pb-0")}>
              {idx < STAGE_ORDER.length - 1 ? (
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
                    {STAGE_SHORT_LABELS[stage]}
                  </p>
                  {isActive ? (
                    <span className="rounded-full bg-sand px-2.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-wide text-nut">
                      In progress
                    </span>
                  ) : null}
                </div>

                {(isDone || isActive) && !compact ? (
                  <p className="mt-2 font-body text-[13px] leading-relaxed text-text-mid">
                    {STAGE_DESCRIPTIONS[stage]}
                  </p>
                ) : null}

                {history ? (
                  <>
                    <p className="mt-2 font-sans text-[11px] text-text-light">
                      Completed · {formatDate(history.completedAt)}
                    </p>
                    {history.notes ? (
                      <p className="mt-2 line-clamp-3 font-body text-[13px] text-text-mid">{history.notes}</p>
                    ) : null}
                    {history.images.length > 0 && !compact ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {history.images.slice(0, 4).map((img) => (
                          <div key={img} className="relative h-12 w-12 overflow-hidden rounded border border-sand">
                            <Image src={img} alt="" fill className="object-cover" unoptimized />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {isActive && history === undefined ? (
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
