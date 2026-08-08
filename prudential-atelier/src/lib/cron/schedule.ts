/**
 * Approximate nominal interval for "stale last success" checks.
 * Weekday-restricted daily jobs still count as ~1 day between fires.
 */
export function cronIntervalMs(schedule: string): number {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length < 5) return 24 * 60 * 60 * 1000;
  const [, , dom, , dow] = parts;

  if (dow !== "*" && !dow.includes("-") && !dow.includes(",") && /^\d+$/.test(dow)) {
    return 7 * 24 * 60 * 60 * 1000;
  }
  if (dom !== "*" && /^\d+$/.test(dom)) {
    return 30 * 24 * 60 * 60 * 1000;
  }
  return 24 * 60 * 60 * 1000;
}

export function isJobStale(params: {
  schedule: string;
  lastOkAt: Date | null;
  now?: Date;
}): boolean {
  if (!params.lastOkAt) return true;
  const now = params.now ?? new Date();
  const threshold = cronIntervalMs(params.schedule) * 2;
  return now.getTime() - params.lastOkAt.getTime() > threshold;
}
