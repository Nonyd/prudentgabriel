/**
 * Approximate nominal interval for "stale last success" checks.
 * Weekday-restricted daily jobs still count as ~1 day between fires.
 */
export function cronIntervalMs(schedule: string): number {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length < 5) return 24 * 60 * 60 * 1000;
  const [minute, , dom, , dow] = parts;
  if (minute === "*") return 60 * 1000;

  if (dow !== "*" && !dow.includes("-") && !dow.includes(",") && /^\d+$/.test(dow)) {
    return 7 * 24 * 60 * 60 * 1000;
  }
  if (dom !== "*" && /^\d+$/.test(dom)) {
    return 30 * 24 * 60 * 60 * 1000;
  }
  return 24 * 60 * 60 * 1000;
}

function cronFieldMatches(field: string, value: number): boolean {
  if (field === "*") return true;
  if (field.includes(",")) {
    return field.split(",").some((part) => cronFieldMatches(part, value));
  }
  if (field.includes("/")) {
    const [range, stepRaw] = field.split("/");
    const step = Number(stepRaw);
    if (!Number.isFinite(step) || step <= 0) return false;
    const start = range === "*" ? 0 : Number(range);
    if (!Number.isFinite(start)) return false;
    return value >= start && (value - start) % step === 0;
  }
  if (field.includes("-")) {
    const [aRaw, bRaw] = field.split("-");
    const a = Number(aRaw);
    const b = Number(bRaw);
    return Number.isFinite(a) && Number.isFinite(b) && value >= a && value <= b;
  }
  return Number(field) === value;
}

/** True when a 5-field UTC cron expression matches `now`. */
export function cronMatches(schedule: string, now: Date): boolean {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dom, month, dow] = parts;
  return (
    cronFieldMatches(minute, now.getUTCMinutes()) &&
    cronFieldMatches(hour, now.getUTCHours()) &&
    cronFieldMatches(dom, now.getUTCDate()) &&
    cronFieldMatches(month, now.getUTCMonth() + 1) &&
    cronFieldMatches(dow, now.getUTCDay())
  );
}

export function isJobStale(params: {
  schedule: string;
  lastOkAt: Date | null;
  now?: Date;
  /** Job run budget; stale window is 2× max(schedule interval, budget). */
  budgetMs?: number;
}): boolean {
  if (!params.lastOkAt) return true;
  const now = params.now ?? new Date();
  const interval = cronIntervalMs(params.schedule);
  const budget = params.budgetMs ?? 0;
  const threshold = Math.max(interval, budget) * 2;
  return now.getTime() - params.lastOkAt.getTime() > threshold;
}
