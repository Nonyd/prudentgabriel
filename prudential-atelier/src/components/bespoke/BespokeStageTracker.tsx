import Image from "next/image";
import type { BespokeStage, StageUpdate } from "@prisma/client";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/bespoke-stages";
import { cn, formatDate } from "@/lib/utils";

type Props = {
  currentStage: BespokeStage;
  stageHistory: StageUpdate[];
  compact?: boolean;
};

export function BespokeStageTracker({ currentStage, stageHistory, compact }: Props) {
  const completedMap = new Map(stageHistory.map((s) => [s.stage, s]));
  const currentIdx = STAGE_ORDER.indexOf(currentStage);

  return (
    <ol className={cn("space-y-0", compact ? "mt-4" : "mt-10")}>
      {STAGE_ORDER.map((stage, idx) => {
        const history = completedMap.get(stage);
        const isDone = Boolean(history);
        const isActive = idx === currentIdx && !isDone;
        const isPending = idx > currentIdx && !isDone;

        return (
          <li key={stage} className={cn("relative flex gap-5", compact ? "pb-6 last:pb-0" : "pb-10 last:pb-0")}>
            {idx < STAGE_ORDER.length - 1 ? (
              <span
                className={cn(
                  "absolute left-4 top-8 h-[calc(100%-8px)] w-0.5 -translate-x-1/2",
                  isDone ? "bg-lightbr" : "bg-sand",
                )}
              />
            ) : null}
            <div
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                isDone && "border-lightbr bg-lightbr",
                isActive && "animate-pulse border-nut bg-nut",
                isPending && "border-sand bg-white",
              )}
            >
              {isDone ? (
                <span className="text-xs text-cream">✓</span>
              ) : (
                <span className={cn("h-2 w-2 rounded-full", isActive ? "bg-cream" : "bg-sand")} />
              )}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p
                className={cn(
                  "font-sans text-sm",
                  isActive && "font-semibold text-nut",
                  isDone && "text-ink",
                  isPending && "text-text-light",
                )}
              >
                {STAGE_LABELS[stage].replace(/^\d+\.\s*/, "")}
              </p>
              {history ? (
                <>
                  <p className="mt-1 font-sans text-[11px] text-text-light">
                    {formatDate(history.completedAt)}
                  </p>
                  {history.notes ? (
                    <p className="mt-2 line-clamp-2 font-sans text-sm text-text-mid">{history.notes}</p>
                  ) : null}
                  {history.images[0] && !compact ? (
                    <div className="relative mt-3 h-20 w-20 overflow-hidden border border-sand">
                      <Image
                        src={history.images[0]}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
