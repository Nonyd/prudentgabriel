import { FINANCE_TZ } from "@/lib/finance/aa0";

export type FinancePeriodKind = "day" | "week" | "month" | "year";

export type FinanceRange = {
  kind: FinancePeriodKind;
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  label: string;
  prevLabel: string;
};

function lagosYmd(at: Date): { y: number; m: number; d: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: FINANCE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(at);
  const num = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wd = parts.find((p) => p.type === "weekday")?.value;
  const weekdayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { y: num("year"), m: num("month"), d: num("day"), weekday: weekdayMap[wd ?? "Mon"] ?? 1 };
}

/** Instant for Lagos calendar y-m-d 00:00. */
export function lagosStart(y: number, m: number, d: number): Date {
  const iso = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T00:00:00+01:00`;
  return new Date(iso);
}

function lagosEndExclusive(y: number, m: number, d: number): Date {
  return new Date(lagosStart(y, m, d).getTime() + 24 * 60 * 60 * 1000);
}

function addDays(y: number, m: number, d: number, delta: number): { y: number; m: number; d: number } {
  const dt = lagosStart(y, m, d);
  dt.setTime(dt.getTime() + delta * 24 * 60 * 60 * 1000);
  const next = lagosYmd(dt);
  return { y: next.y, m: next.m, d: next.d };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function labelDay(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function financeRange(kind: FinancePeriodKind, now: Date): FinanceRange {
  const { y, m, d, weekday } = lagosYmd(now);
  if (kind === "day") {
    const from = lagosStart(y, m, d);
    const to = lagosEndExclusive(y, m, d);
    const prev = addDays(y, m, d, -1);
    return {
      kind,
      from,
      to,
      prevFrom: lagosStart(prev.y, prev.m, prev.d),
      prevTo: from,
      label: labelDay(y, m, d),
      prevLabel: labelDay(prev.y, prev.m, prev.d),
    };
  }
  if (kind === "week") {
    const back = weekday - 1;
    const start = addDays(y, m, d, -back);
    const end = addDays(start.y, start.m, start.d, 7);
    const prevStart = addDays(start.y, start.m, start.d, -7);
    return {
      kind,
      from: lagosStart(start.y, start.m, start.d),
      to: lagosStart(end.y, end.m, end.d),
      prevFrom: lagosStart(prevStart.y, prevStart.m, prevStart.d),
      prevTo: lagosStart(start.y, start.m, start.d),
      label: `Week of ${labelDay(start.y, start.m, start.d)}`,
      prevLabel: `Week of ${labelDay(prevStart.y, prevStart.m, prevStart.d)}`,
    };
  }
  if (kind === "month") {
    const from = lagosStart(y, m, 1);
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    const to = lagosStart(nextY, nextM, 1);
    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    return {
      kind,
      from,
      to,
      prevFrom: lagosStart(prevY, prevM, 1),
      prevTo: from,
      label: `${y}-${pad(m)}`,
      prevLabel: `${prevY}-${pad(prevM)}`,
    };
  }
  const from = lagosStart(y, 1, 1);
  const to = lagosStart(y + 1, 1, 1);
  return {
    kind,
    from,
    to,
    prevFrom: lagosStart(y - 1, 1, 1),
    prevTo: from,
    label: String(y),
    prevLabel: String(y - 1),
  };
}

export function customRange(fromIso: string, toIso: string): { from: Date; to: Date } {
  const fromDay = fromIso.slice(0, 10);
  const toDay = toIso.slice(0, 10);
  const [fy, fm, fd] = fromDay.split("-").map(Number);
  const [ty, tm, td] = toDay.split("-").map(Number);
  const end = addDays(ty, tm, td, 1);
  return {
    from: lagosStart(fy, fm, fd),
    to: lagosStart(end.y, end.m, end.d),
  };
}

export function inRange(at: Date, from: Date, to: Date): boolean {
  return at >= from && at < to;
}
