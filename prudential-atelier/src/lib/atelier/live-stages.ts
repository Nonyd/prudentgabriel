import type { BespokeStage } from "@prisma/client";
import { clientStageNote } from "@/lib/atelier/intake-stages";

export function liveCompletionStages(
  completions: Array<{ stage: BespokeStage; revertedAt: Date | string | null }>,
): Set<BespokeStage> {
  const live = new Set<BespokeStage>();
  for (const row of completions) {
    if (!row.revertedAt) live.add(row.stage);
  }
  return live;
}

export function stageHistoryForLiveCompletions<T extends { stage: BespokeStage }>(
  history: T[],
  live: Set<BespokeStage>,
): T[] {
  const byStage = new Map<BespokeStage, T>();
  for (const row of history) {
    if (live.has(row.stage)) byStage.set(row.stage, row);
  }
  return Array.from(byStage.values());
}

export function countLiveCompletions(live: Set<BespokeStage>): number {
  return live.size;
}

export function isLiveStageDone(stage: BespokeStage, live: Set<BespokeStage>): boolean {
  return live.has(stage);
}

/**
 * What her own pages show (dashboard, commission page, /track): the live
 * completions, with the house's system notes on the intake stages in her words.
 */
export function clientStageHistory<T extends { stage: BespokeStage; notes?: string | null }>(
  history: T[],
  live: Set<BespokeStage>,
): T[] {
  return stageHistoryForLiveCompletions(history, live).map((row) =>
    row.notes == null ? row : { ...row, notes: clientStageNote(row.stage, row.notes) },
  );
}
