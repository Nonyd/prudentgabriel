import type { BespokeStage } from "@prisma/client";

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
