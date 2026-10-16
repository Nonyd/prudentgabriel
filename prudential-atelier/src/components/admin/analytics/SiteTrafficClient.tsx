"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CountRow, TrafficRangeId, TrafficReport, TrafficTotals } from "@/lib/analytics/traffic-view";

const RANGES: { id: Exclude<TrafficRangeId, "custom">; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "12m", label: "12 months" },
  { id: "all", label: "All time" },
];

type RangeSpec = { id: TrafficRangeId; from?: string; to?: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function specToQuery(spec: RangeSpec) {
  const q = new URLSearchParams({ range: spec.id });
  if (spec.id === "custom" && spec.from && spec.to) {
    q.set("from", spec.from);
    q.set("to", spec.to);
  }
  return q.toString();
}

/** The page address carries the period, so a reload or a shared link opens the same view. */
function specFromLocation(): RangeSpec {
  if (typeof window === "undefined") return { id: "30d" };
  const q = new URLSearchParams(window.location.search);
  const id = q.get("range");
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  if (id === "custom" && ISO_DAY.test(from) && ISO_DAY.test(to)) return { id, from, to };
  return RANGES.some((r) => r.id === id) ? { id: id as TrafficRangeId } : { id: "30d" };
}

const CHIP = "admin-chip glass-1 glass-pill min-h-[40px] font-sans text-xs uppercase tracking-wider transition-colors";
const CHIP_ON = "!border-[var(--choc)] !bg-[var(--choc)] !text-[var(--bg-card)]";

function RangePicker({
  spec,
  firstDay,
  today,
  onChange,
}: {
  spec: RangeSpec;
  firstDay: string | null;
  today: string | null;
  onChange: (spec: RangeSpec) => void;
}) {
  const [open, setOpen] = useState(spec.id === "custom");
  const [from, setFrom] = useState(spec.from ?? "");
  const [to, setTo] = useState(spec.to ?? "");

  useEffect(() => {
    if (spec.id === "custom") {
      setFrom(spec.from ?? "");
      setTo(spec.to ?? "");
    }
  }, [spec]);

  useEffect(() => {
    if (!to && today) setTo(today);
  }, [to, today]);

  const valid = Boolean(from && to && from <= to);
  const field = "min-h-[40px] rounded-full border border-sand bg-[var(--bg-card)] px-3 font-sans text-sm text-choc";

  return (
    <div className="flex flex-col gap-3 lg:items-end">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Period">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={spec.id === r.id}
            onClick={() => {
              setOpen(false);
              onChange({ id: r.id });
            }}
            className={`${CHIP} ${spec.id === r.id ? CHIP_ON : "text-text-mid hover:text-choc"}`}
          >
            {r.label}
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={spec.id === "custom"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`${CHIP} ${spec.id === "custom" ? CHIP_ON : "text-text-mid hover:text-choc"}`}
        >
          Custom
        </button>
      </div>
      {open ? (
        <form
          className="glass-opaque flex flex-wrap items-end gap-3 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onChange({ id: "custom", from, to });
          }}
        >
          <label className="flex flex-col gap-1 font-sans text-10px uppercase tracking-wider text-text-mid">
            From
            <input
              type="date"
              required
              value={from}
              min={firstDay ?? undefined}
              max={to || today || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1 font-sans text-10px uppercase tracking-wider text-text-mid">
            To
            <input
              type="date"
              required
              value={to}
              min={from || firstDay || undefined}
              max={today ?? undefined}
              onChange={(e) => setTo(e.target.value)}
              className={field}
            />
          </label>
          <button
            type="submit"
            disabled={!valid}
            className="min-h-[40px] rounded-full bg-[var(--choc)] px-5 font-sans text-xs uppercase tracking-wider text-[var(--bg-card)] disabled:opacity-40"
          >
            Show
          </button>
          {firstDay ? (
            <p className="basis-full font-sans text-11px text-text-mid">Counting began {shortDate(firstDay)}.</p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

const TREND_METRICS = [
  { id: "pageviews", label: "Page views" },
  { id: "sessions", label: "Visits" },
  { id: "visitors", label: "Visitors" },
] as const;
type TrendMetric = (typeof TREND_METRICS)[number]["id"];

const GAP_LABELS: Record<string, string> = {
  first: "First visit",
  "1d": "Yesterday",
  "2-7d": "2–7 days ago",
  "8-30d": "8–30 days ago",
  "30d+": "Over a month ago",
};

const SCREEN_LABELS: Record<string, string> = {
  "<375": "Small phone (under 375px)",
  "375-767": "Phone (375–767px)",
  "768-1023": "Tablet (768–1023px)",
  "1024-1439": "Laptop (1024–1439px)",
  "1440+": "Large screen (1440px+)",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const AXIS_TICK = { fill: "var(--text-mid)", fontSize: 11 };
const TOOLTIP_STYLE = {
  background: "var(--bg-card)",
  border: "1px solid var(--sand)",
  borderRadius: 4,
  fontSize: 12,
  color: "var(--choc)",
};

function n(v: number) {
  return Math.round(v).toLocaleString("en-NG");
}

function naira(v: number) {
  return `₦${Math.round(v).toLocaleString("en-NG")}`;
}

function nairaShort(v: number) {
  return `₦${new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 }).format(Math.round(v))}`;
}

function pct(v: number, digits = 1) {
  return `${(v * 100).toFixed(digits)}%`;
}

function duration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function shortDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

let regionNames: Intl.DisplayNames | null = null;
function countryLabel(code: string) {
  if (code === "unknown") return "Unknown";
  if (code === "T1") return "Tor network";
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

function flag(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(...Array.from(code).map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Change against the previous period. `lowerIsBetter` flips the colour, never the sign. */
function Delta({ now, was, kind, lowerIsBetter }: { now: number; was: number; kind: "count" | "rate" | "seconds" | "money"; lowerIsBetter?: boolean }) {
  if (now === 0 && was === 0) return <span className="text-text-mid">No change</span>;
  if (was === 0) return <span className="text-text-mid">New this period</span>;
  let text: string;
  const diff = now - was;
  if (kind === "rate") text = `${diff >= 0 ? "+" : "−"}${Math.abs(diff * 100).toFixed(1)} pt`;
  else {
    const rel = diff / was;
    text = `${rel >= 0 ? "+" : "−"}${Math.abs(rel * 100).toFixed(rel !== 0 && Math.abs(rel) < 0.1 ? 1 : 0)}%`;
  }
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  const tone = diff === 0 ? "text-text-mid" : good ? "text-success" : "text-error";
  return (
    <span className={tone}>
      <span aria-hidden>{diff > 0 ? "▲ " : diff < 0 ? "▼ " : ""}</span>
      {text}
      <span className="text-text-mid"> vs before</span>
    </span>
  );
}

function Kpi({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: React.ReactNode;
}) {
  return (
    <div className="glass-opaque p-4">
      <p className="font-sans text-10px uppercase tracking-wider text-text-mid">{label}</p>
      <p className="mt-1.5 font-display text-2xl text-choc tabular-nums">{value}</p>
      {delta ? <p className="mt-1 font-sans text-11px">{delta}</p> : null}
      {hint ? <p className="mt-1 font-sans text-11px text-text-mid">{hint}</p> : null}
    </div>
  );
}

function Panel({
  title,
  note,
  children,
  className = "",
  action,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={`glass-opaque min-w-0 p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-choc">{title}</h2>
          {note ? <p className="mt-0.5 font-sans text-xs text-text-mid">{note}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center font-sans text-sm text-text-mid">{children}</p>;
}

/** Ranked horizontal bars. One hue: the bar is magnitude, the label carries identity. */
function BarList({
  rows,
  label,
  icon,
  empty = "Nothing counted in this period.",
  limit = 10,
}: {
  rows: CountRow[];
  label?: (key: string) => string;
  icon?: (key: string) => React.ReactNode;
  empty?: string;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const total = rows.reduce((s, r) => s + r.count, 0);
  const shown = expanded ? rows : rows.slice(0, limit);
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (total === 0) return <Empty>{empty}</Empty>;
  return (
    <>
      <ul className="space-y-1.5">
        {shown.map((r) => {
          const name = label ? label(r.key) : r.key;
          return (
            <li
              key={r.key}
              className="group relative"
              title={`${name}: ${n(r.count)} (${pct(r.count / total)})`}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-[4px] bg-[color-mix(in_srgb,var(--choc)_12%,transparent)] transition-colors group-hover:bg-[color-mix(in_srgb,var(--choc)_20%,transparent)]"
                style={{ width: r.count === 0 ? 0 : `${Math.max(1.5, (r.count / max) * 100)}%` }}
                aria-hidden
              />
              <div className="relative flex items-center justify-between gap-3 px-2 py-1.5 font-sans text-sm">
                <span className="flex min-w-0 items-center gap-2 text-choc">
                  {icon ? <span className="shrink-0">{icon(r.key)}</span> : null}
                  <span className="truncate">{name}</span>
                </span>
                <span className="shrink-0 tabular-nums text-text-mid">
                  {n(r.count)} <span className="inline-block w-12 text-right text-11px">{pct(r.count / total, 0)}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {rows.length > limit ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 font-sans text-xs text-choc underline underline-offset-2"
        >
          {expanded ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      ) : null}
    </>
  );
}

function Tabs<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-full px-3 py-1 font-sans text-xs transition-colors ${
            value === o.id ? "bg-[var(--choc)] text-[var(--bg-card)]" : "text-text-mid hover:text-choc"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TrendPanel({ report }: { report: TrafficReport }) {
  const [metric, setMetric] = useState<TrendMetric>("pageviews");
  const label = TREND_METRICS.find((m) => m.id === metric)!.label;
  const total = report.series.reduce((s, p) => s + p[metric], 0);
  const peak = report.series.reduce((best, p) => (p[metric] > (best?.[metric] ?? -1) ? p : best), report.series[0]);
  return (
    <Panel
      title="Traffic over time"
      note={
        total > 0 && peak
          ? `${n(total)} ${label.toLowerCase()} · busiest ${report.range.monthly ? "month" : "day"} ${peak.label} (${n(peak[metric])})`
          : undefined
      }
      action={<Tabs value={metric} options={TREND_METRICS} onChange={setMetric} label="Metric" />}
    >
      {total === 0 ? (
        <Empty>No {label.toLowerCase()} counted in this period yet.</Empty>
      ) : (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={report.series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--choc)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--choc)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--sand)" strokeOpacity={0.6} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={44} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ stroke: "var(--choc)", strokeOpacity: 0.3 }}
                formatter={(v) => [n(Number(v)), label]}
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke="var(--choc)"
                strokeWidth={2}
                fill="url(#trafficFill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--bg-card)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

function LivePanel({ report }: { report: TrafficReport }) {
  const last5 = report.live.filter((m) => m.minutesAgo < 5).reduce((s, m) => s + m.count, 0);
  const last30 = report.live.reduce((s, m) => s + m.count, 0);
  const max = Math.max(1, ...report.live.map((m) => m.count));
  return (
    <Panel title="Right now" note="Page views per minute, last 30 minutes. Refreshes every minute.">
      <div className="flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
          {last5 > 0 ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
          ) : null}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${last5 > 0 ? "bg-success" : "bg-sand"}`} />
        </span>
        <p className="font-display text-4xl leading-none text-choc tabular-nums">{n(last5)}</p>
        <p className="font-sans text-xs text-text-mid">views in the last 5 minutes · {n(last30)} in 30</p>
      </div>
      <div className="mt-4 flex h-16 items-end gap-[2px]" role="img" aria-label={`${n(last30)} page views in the last 30 minutes`}>
        {report.live.map((m) => (
          <div
            key={m.minutesAgo}
            title={`${m.minutesAgo === 0 ? "This minute" : `${m.minutesAgo} min ago`}: ${m.count}`}
            className="flex-1 rounded-t-[3px] bg-[var(--choc)] transition-opacity hover:opacity-100"
            style={{ height: `${m.count === 0 ? 3 : Math.max(8, (m.count / max) * 100)}%`, opacity: m.count === 0 ? 0.15 : 0.75 }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-sans text-10px text-text-mid">
        <span>30 min ago</span>
        <span>now</span>
      </div>
    </Panel>
  );
}

function VisitorsPanel({ report }: { report: TrafficReport }) {
  const t = report.totals;
  const data = report.series.map((p) => ({ label: p.label, Returning: p.returning, New: Math.max(0, p.visitors - p.returning) }));
  const share = t.visitors > 0 ? t.returningVisitors / t.visitors : 0;
  return (
    <Panel title="New and returning" note={t.visitors > 0 ? `${pct(share, 0)} of visitors had been here before.` : undefined}>
      {t.visitors === 0 ? (
        <Empty>No visitors counted in this period yet.</Empty>
      ) : (
        <>
          <div className="mb-3 flex gap-4 font-sans text-xs text-text-mid">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-[var(--choc)]" aria-hidden /> Returning {n(t.returningVisitors)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-[color-mix(in_srgb,var(--choc)_35%,transparent)]" aria-hidden /> New{" "}
              {n(t.newVisitors)}
            </span>
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid stroke="var(--sand)" strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={44} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--choc)", fillOpacity: 0.06 }} />
                <Bar dataKey="Returning" stackId="v" fill="var(--choc)" stroke="var(--bg-card)" strokeWidth={1} />
                <Bar
                  dataKey="New"
                  stackId="v"
                  fill="color-mix(in srgb, var(--choc) 35%, transparent)"
                  stroke="var(--bg-card)"
                  strokeWidth={1}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <h3 className="mt-5 font-sans text-10px uppercase tracking-wider text-text-mid">Last visit before this one</h3>
          <div className="mt-2">
            <BarList rows={report.gaps} label={(k) => GAP_LABELS[k] ?? k} />
          </div>
        </>
      )}
    </Panel>
  );
}

function HeatPanel({ report }: { report: TrafficReport }) {
  const max = Math.max(1, ...report.heat.flat());
  const total = report.heat.flat().reduce((s, v) => s + v, 0);
  let best = { d: 0, h: 0, v: 0 };
  report.heat.forEach((row, d) => row.forEach((v, h) => (v > best.v ? (best = { d, h, v }) : null)));
  // Monday first: the working week reads left to right.
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <Panel
      title="When they visit"
      note={total > 0 ? `Lagos time. Busiest: ${WEEKDAYS[best.d]} around ${String(best.h).padStart(2, "0")}:00.` : "Lagos time."}
    >
      {total === 0 ? (
        <Empty>No page views counted by hour in this period.</Empty>
      ) : (
        <div>
          <div>
            <div className="ml-9 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px] font-sans text-[9px] text-text-mid">
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="text-center">
                  {h % 6 === 0 ? String(h).padStart(2, "0") : ""}
                </span>
              ))}
            </div>
            {order.map((d) => (
              <div key={d} className="mt-[2px] flex items-center gap-[2px]">
                <span className="w-9 shrink-0 font-sans text-10px text-text-mid">{WEEKDAYS[d]}</span>
                <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]">
                  {report.heat[d]!.map((v, h) => (
                    <div
                      key={h}
                      title={`${WEEKDAYS[d]} ${String(h).padStart(2, "0")}:00 – ${n(v)} views`}
                      className="aspect-square rounded-[3px] bg-[var(--choc)]"
                      style={{ opacity: v === 0 ? 0.05 : 0.15 + 0.85 * (v / max) }}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-3 flex items-center justify-end gap-2 font-sans text-10px text-text-mid">
              Fewer
              {[0.15, 0.35, 0.6, 0.8, 1].map((o) => (
                <span key={o} className="h-2.5 w-2.5 rounded-[2px] bg-[var(--choc)]" style={{ opacity: o }} aria-hidden />
              ))}
              More
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function PagesPanel({ report }: { report: TrafficReport }) {
  const total = report.totals.pageviews;
  const compare = report.range.prevFrom != null;
  return (
    <Panel title="Top pages" note="What people open most, and how long they stay. Entries are visits that started on that page.">
      {report.pages.length === 0 ? (
        <Empty>No page views in this period.</Empty>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full font-sans text-sm sm:min-w-[560px]">
            <thead>
              <tr className="border-b border-sand text-left text-10px uppercase tracking-wider text-text-mid">
                <th className="px-2 py-2 font-medium">Page</th>
                <th className="px-2 py-2 text-right font-medium">Views</th>
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Share</th>
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Entries</th>
                <th className="px-2 py-2 text-right font-medium">Avg time</th>
                {compare ? <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Change</th> : null}
              </tr>
            </thead>
            <tbody>
              {report.pages.map((p) => (
                <tr key={p.path} className="border-b border-sand/60 hover:bg-[color-mix(in_srgb,var(--choc)_4%,transparent)]">
                  <td className="max-w-[160px] truncate px-2 py-2 sm:max-w-[260px]">
                    <a href={p.path} target="_blank" rel="noreferrer" className="text-choc hover:underline" title={p.path}>
                      {p.path}
                    </a>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-choc">{n(p.views)}</td>
                  <td className="hidden px-2 py-2 text-right tabular-nums text-text-mid sm:table-cell">{total > 0 ? pct(p.views / total) : "—"}</td>
                  <td className="hidden px-2 py-2 text-right tabular-nums text-text-mid sm:table-cell">{p.entries ? n(p.entries) : "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-text-mid">{duration(p.avgSeconds)}</td>
                  {compare ? (
                    <td className="hidden px-2 py-2 text-right text-11px sm:table-cell">
                      <Delta now={p.views} was={p.prevViews} kind="count" />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function SourcesPanel({ report }: { report: TrafficReport }) {
  return (
    <Panel
      title="Referral links"
      note="The site or tag each visit arrived from, and the paid orders placed in that same visit."
    >
      {report.sources.length === 0 ? (
        <Empty>No visits recorded in this period.</Empty>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full font-sans text-sm">
            <thead>
              <tr className="border-b border-sand text-left text-10px uppercase tracking-wider text-text-mid">
                <th className="px-2 py-2 font-medium">Source</th>
                <th className="px-2 py-2 text-right font-medium">Visits</th>
                <th className="px-2 py-2 text-right font-medium">Orders</th>
                <th className="px-2 py-2 text-right font-medium">Sales</th>
              </tr>
            </thead>
            <tbody>
              {report.sources.map((s) => (
                <tr key={s.source} className="border-b border-sand/60">
                  <td className="max-w-[120px] truncate px-2 py-2 text-choc sm:max-w-[220px]">{s.source === "(direct)" ? "Direct" : s.source}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-choc">{n(s.landings)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-text-mid">{s.orders ? n(s.orders) : "—"}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-text-mid"><span title={naira(s.revenueNGN)}>{s.revenueNGN ? nairaShort(s.revenueNGN) : "—"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function CampaignsPanel({ report }: { report: TrafficReport }) {
  return (
    <Panel title="Campaigns" note="Links tagged with utm_campaign. How to tag a post is on How we are doing.">
      {report.campaigns.length === 0 ? (
        <Empty>No tagged campaign visits in this period.</Empty>
      ) : (
        <ul className="divide-y divide-sand/60">
          {report.campaigns.map((c) => (
            <li key={c.label} className="flex items-baseline justify-between gap-3 py-2 font-sans text-sm">
              <span className="min-w-0 truncate text-choc" title={c.label}>
                {c.label}
              </span>
              <span className="shrink-0 text-right text-xs tabular-nums text-text-mid">
                {n(c.landings)} visits · {n(c.orders)} orders{c.revenueNGN ? ` · ${naira(c.revenueNGN)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ProductsPanel({ report }: { report: TrafficReport }) {
  return (
    <Panel title="Most viewed pieces" note="Product page opens against units paid for in the same period.">
      {report.products.length === 0 ? (
        <Empty>No product pages opened in this period.</Empty>
      ) : (
        <ul className="divide-y divide-sand/60">
          {report.products.map((p) => (
            <li key={p.productId} className="flex items-baseline justify-between gap-3 py-2 font-sans text-sm">
              <Link href={`/admin/products/${p.productId}`} className="min-w-0 truncate text-choc hover:underline">
                {p.name}
              </Link>
              <span className="shrink-0 text-xs tabular-nums text-text-mid">
                {n(p.views)} views · {p.unitsSold ? `${n(p.unitsSold)} sold` : "none sold"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="glass-opaque h-[104px] animate-pulse" />
        ))}
      </div>
      <div className="glass-opaque h-[320px] animate-pulse" />
    </div>
  );
}

function kpis(t: TrafficTotals, p: TrafficTotals, partialFrom: string | null, compare: boolean) {
  const d = (node: React.ReactNode) => (compare ? node : undefined);
  const since = partialFrom
    ? `Since ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${partialFrom}T00:00:00Z`))}`
    : null;
  return [
    {
      label: "Visitors",
      value: n(t.visitors),
      delta: d(<Delta now={t.visitors} was={p.visitors} kind="count" />),
      hint: since ?? "One per browser per day",
    },
    {
      label: "Returning visitors",
      value: t.visitors > 0 ? pct(t.returningVisitors / t.visitors, 0) : "—",
      delta: d(
        <Delta
          now={t.visitors ? t.returningVisitors / t.visitors : 0}
          was={p.visitors ? p.returningVisitors / p.visitors : 0}
          kind="rate"
        />
      ),
      hint: since ?? `${n(t.returningVisitors)} came back`,
    },
    { label: "Page views", value: n(t.pageviews), delta: d(<Delta now={t.pageviews} was={p.pageviews} kind="count" />) },
    {
      label: "Visits",
      value: n(t.sessions),
      delta: d(<Delta now={t.sessions} was={p.sessions} kind="count" />),
      hint: `${t.pagesPerSession.toFixed(1)} pages per visit`,
    },
    {
      label: "Bounce rate",
      value: t.bounceRate == null ? "—" : pct(t.bounceRate, 0),
      delta: t.bounceRate == null ? undefined : d(<Delta now={t.bounceRate} was={p.bounceRate ?? 0} kind="rate" lowerIsBetter />),
      hint: since ?? "Left after one page, under 10 s",
    },
    {
      label: "Avg time on page",
      value: duration(t.avgPageSeconds),
      delta: d(<Delta now={t.avgPageSeconds} was={p.avgPageSeconds} kind="seconds" />),
      hint: since ?? undefined,
    },
    {
      label: "Orders",
      value: n(t.orders),
      delta: d(<Delta now={t.orders} was={p.orders} kind="count" />),
      hint: t.revenueNGN ? `${naira(t.revenueNGN)} in sales` : undefined,
    },
    {
      label: "Visit to order",
      value: t.sessions > 0 ? pct(t.conversion, 2) : "—",
      delta: d(<Delta now={t.conversion} was={p.conversion} kind="rate" />),
      hint: `${n(t.countedOrders)} ${t.countedOrders === 1 ? "order" : "orders"} came from counted visits`,
    },
  ];
}

const DEVICE_TABS = [
  { id: "devices", label: "Device" },
  { id: "browsers", label: "Browser" },
  { id: "os", label: "System" },
  { id: "screens", label: "Screen" },
] as const;
type DeviceTab = (typeof DEVICE_TABS)[number]["id"];

const SOURCE_TABS = [
  { id: "channels", label: "Channels" },
  { id: "landings", label: "Entry pages" },
] as const;
type SourceTab = (typeof SOURCE_TABS)[number]["id"];

export function SiteTrafficClient() {
  const [spec, setSpec] = useState<RangeSpec | null>(null);
  const [report, setReport] = useState<TrafficReport | null>(null);
  const [error, setError] = useState(false);
  const [deviceTab, setDeviceTab] = useState<DeviceTab>("devices");
  const [sourceTab, setSourceTab] = useState<SourceTab>("channels");

  /** Only the newest request may land: a slow answer for the old period must not overwrite the new one. */
  const latest = useRef(0);

  const load = useCallback(
    async (quiet = false) => {
      if (!spec) return;
      const ticket = ++latest.current;
      if (!quiet) setReport(null);
      try {
        const res = await fetch(`/api/admin/analytics/traffic?${specToQuery(spec)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as TrafficReport;
        if (ticket !== latest.current) return;
        setReport(next);
        setError(false);
      } catch {
        if (!quiet && ticket === latest.current) setError(true);
      }
    },
    [spec],
  );

  useEffect(() => {
    setSpec(specFromLocation());
  }, []);

  const changeSpec = useCallback((next: RangeSpec) => {
    setSpec(next);
    try {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${specToQuery(next)}`);
    } catch {
      /* the address bar is a convenience */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const tiles = useMemo(() => {
    if (!report) return [];
    const since = report.visitorsSince;
    const partial = since == null || since > report.range.from ? (since ?? report.range.to) : null;
    return kpis(report.totals, report.prevTotals, partial, report.range.prevFrom != null);
  }, [report]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="admin-heading-pill glass-1 glass-pill font-display text-3xl text-choc">Site traffic</h1>
          <p className="mt-1 max-w-2xl font-sans text-sm text-text-mid">
            Who visits the shop, from where, and what they look at. Money and funnels live in{" "}
            <Link href="/admin/reports" className="text-choc underline">
              How we are doing
            </Link>
            .
          </p>
        </div>
        {spec ? (
          <RangePicker
            spec={spec}
            firstDay={report?.range.firstDay ?? null}
            today={report?.range.today ?? null}
            onChange={changeSpec}
          />
        ) : null}
      </header>

      {error ? (
        <div className="glass-opaque p-6 font-sans text-sm text-text-mid">
          Could not load site traffic.{" "}
          <button type="button" onClick={() => void load()} className="text-choc underline">
            Try again
          </button>
        </div>
      ) : !report ? (
        <Skeleton />
      ) : (
        <>
          <p className="font-sans text-xs uppercase tracking-wider text-text-mid">
            {report.range.from === report.range.to
              ? shortDate(report.range.from)
              : `${shortDate(report.range.from)} – ${shortDate(report.range.to)}`}
            {report.range.prevFrom && report.range.prevTo
              ? ` · compared with ${
                  report.range.prevFrom === report.range.prevTo
                    ? shortDate(report.range.prevFrom)
                    : `${shortDate(report.range.prevFrom)} – ${shortDate(report.range.prevTo)}`
                }`
              : " · everything counted so far"}
          </p>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tiles.map((k) => (
              <Kpi key={k.label} {...k} />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <TrendPanel report={report} />
            </div>
            <LivePanel report={report} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Countries"
              note={
                report.countryKnown
                  ? "Where visitors are, as Cloudflare reports it. Never stored with an IP address."
                  : "Country comes from Cloudflare, which only fronts the live site. Here it shows as unknown."
              }
            >
              <BarList rows={report.countries} label={countryLabel} icon={(k) => <span aria-hidden>{flag(k)}</span>} />
            </Panel>
            <Panel
              title="How they found us"
              action={<Tabs value={sourceTab} options={SOURCE_TABS} onChange={setSourceTab} label="Breakdown" />}
              note={sourceTab === "channels" ? "Each visit, sorted by where it came from." : "The first page of each visit."}
            >
              {sourceTab === "channels" ? (
                <BarList rows={report.channels} empty="No visits recorded in this period." />
              ) : (
                <BarList rows={report.landings} empty="No visits recorded in this period." />
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SourcesPanel report={report} />
            <CampaignsPanel report={report} />
          </div>

          <PagesPanel report={report} />

          <div className="grid gap-4 lg:grid-cols-2">
            <VisitorsPanel report={report} />
            <Panel
              title="Devices"
              action={<Tabs value={deviceTab} options={DEVICE_TABS} onChange={setDeviceTab} label="Device breakdown" />}
              note="Per visitor per day."
            >
              <BarList
                rows={report[deviceTab]}
                label={deviceTab === "screens" ? (k) => SCREEN_LABELS[k] ?? k : undefined}
              />
            </Panel>
          </div>

          <HeatPanel report={report} />

          <div className="grid gap-4 lg:grid-cols-2">
            <ProductsPanel report={report} />
            <Panel title="Broken links" note="Addresses visitors tried that have no page. Worth a redirect if they recur.">
              <BarList rows={report.notFound} empty="No missing pages hit in this period." />
            </Panel>
          </div>

          <section className="glass-opaque p-5 font-sans text-xs leading-relaxed text-text-mid">
            <h2 className="font-display text-base text-choc">About these numbers</h2>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>
                Only visitors who chose <strong>Accept all</strong> on the cookie banner are counted. Everyone else is
                invisible here, so treat these as a floor, not a total.
              </li>
              <li>
                Real people only: {n(report.totals.bots)} requests from crawlers, link previews and scripts were kept out
                this period. Admin pages and staff viewing the site as a client are never counted.
              </li>
              <li>
                Nothing here identifies anyone. A browser remembers only the date of its last visit, so a visitor on two
                days counts twice, and the same person on phone and laptop counts as two.
              </li>
              <li>
                Day-by-day detail is kept for {report.retentionDays} days, then folded into monthly totals (hour-by-day
                and per-day detail are not kept for those months). Country, device, return visits and time on page
                started counting on 16 October 2026.
              </li>
            </ul>
            <p className="mt-3">Updated {new Date(report.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.</p>
          </section>
        </>
      )}
    </div>
  );
}
