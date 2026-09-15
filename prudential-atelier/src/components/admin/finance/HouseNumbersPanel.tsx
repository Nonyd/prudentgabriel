"use client";

import type { FunnelStep, HouseNumbers, LookedRow, TrafficRow } from "@/lib/analytics/view";

function naira(n: number) {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function vsPrev(now: number, was: number, kind: "number" | "money" | "rate") {
  if (was === 0 && now === 0) return "same as previous";
  if (was === 0) return "new";
  if (kind === "rate") {
    const d = (now - was) * 100;
    return `${d > 0 ? "+" : ""}${d.toFixed(1)} pt vs previous`;
  }
  const d = now - was;
  if (kind === "money") return `${d > 0 ? "+" : ""}${naira(d)} vs previous`;
  return `${d > 0 ? "+" : ""}${d.toLocaleString("en-NG")} vs previous`;
}

function biggestDrop(steps: FunnelStep[]): string | null {
  let worst: { label: string; drop: number } | null = null;
  for (let i = 1; i < steps.length; i++) {
    const from = steps[i - 1]!.count;
    const to = steps[i]!.count;
    if (from <= 0) continue;
    const drop = (from - to) / from;
    if (!worst || drop > worst.drop) worst = { label: `${steps[i - 1]!.label} to ${steps[i]!.label}`, drop };
  }
  if (!worst || worst.drop <= 0) return null;
  return `Biggest drop: ${worst.label} (${Math.round(worst.drop * 100)}%).`;
}

function Funnel({ title, steps }: { title: string; steps: FunnelStep[] }) {
  const max = Math.max(...steps.map((s) => s.count), 1);
  const note = biggestDrop(steps);
  return (
    <div className="glass-opaque p-5">
      <h2 className="font-display text-lg text-choc">{title}</h2>
      {note ? <p className="mt-1 font-sans text-xs text-[#6B6B68]">{note}</p> : null}
      <ol className="mt-4 space-y-3">
        {steps.map((step) => (
          <li key={step.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-sans text-sm text-choc">{step.label}</p>
              <p className="font-sans text-xs text-[#6B6B68]">
                {step.count.toLocaleString("en-NG")} · {vsPrev(step.count, step.prevCount, "number")}
              </p>
            </div>
            <div className="mt-1.5 h-2 w-full bg-sand/70">
              <div className="h-2 bg-[var(--choc-deep)]" style={{ width: `${Math.max(4, (step.count / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Traffic({ rows, note }: { rows: TrafficRow[]; note: string }) {
  return (
    <div className="glass-opaque p-5">
      <h2 className="font-display text-lg text-choc">Where they came from</h2>
      <p className="mt-2 max-w-2xl whitespace-pre-line font-sans text-xs leading-relaxed text-[#6B6B68]">{note}</p>
      {rows.length === 0 ? (
        <p className="mt-4 font-sans text-sm text-[#6B6B68]">No tagged landings or attributed orders in this period.</p>
      ) : (
        <table className="mt-4 w-full font-sans text-sm">
          <thead>
            <tr className="border-b border-sand text-left text-[10px] uppercase tracking-wider text-[#6B6B68]">
              <th className="py-2 font-medium">Source</th>
              <th className="py-2 font-medium">Landings</th>
              <th className="py-2 font-medium">Orders</th>
              <th className="py-2 font-medium">Sales</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.source}-${row.campaign}-${row.content}`} className="border-b border-sand/60">
                <td className="py-2 text-choc">{row.label}</td>
                <td className="py-2 text-[#6B6B68]">{row.landings.toLocaleString("en-NG")}</td>
                <td className="py-2 text-[#6B6B68]">{row.orders.toLocaleString("en-NG")}</td>
                <td className="py-2 text-[#6B6B68]">{naira(row.revenueNGN)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Looked({ rows }: { rows: LookedRow[] }) {
  return (
    <div className="glass-opaque p-5">
      <h2 className="font-display text-lg text-choc">Looked at, not bought</h2>
      <p className="mt-1 font-sans text-xs text-[#6B6B68]">
        Pieces opened this period with no paid order. Nothing else on this screen tells you that.
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 font-sans text-sm text-[#6B6B68]">No product views without a sale in this period.</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {rows.map((row) => (
            <li key={row.productId} className="flex items-baseline justify-between gap-3 border-b border-sand/60 py-2">
              <span className="font-sans text-sm text-choc">{row.name}</span>
              <span className="shrink-0 font-sans text-xs text-[#6B6B68]">{row.views.toLocaleString("en-NG")} views</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function HouseNumbersPanel({ data }: { data: HouseNumbers }) {
  const kpis = [
    { label: "Visits", value: data.visits.toLocaleString("en-NG"), prev: vsPrev(data.visits, data.visitsPrev, "number") },
    { label: "Orders", value: data.orders.toLocaleString("en-NG"), prev: vsPrev(data.orders, data.ordersPrev, "number") },
    { label: "Conversion", value: pct(data.conversion), prev: vsPrev(data.conversion, data.conversionPrev, "rate") },
    { label: "Revenue", value: naira(data.revenueNGN), prev: vsPrev(data.revenueNGN, data.revenuePrev, "money") },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="glass-opaque p-5">
            <p className="font-sans text-[10px] uppercase tracking-wider text-[#6B6B68]">{k.label}</p>
            <p className="mt-2 font-display text-2xl text-choc">{k.value}</p>
            <p className="mt-1 font-sans text-xs text-[#6B6B68]">{k.prev}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Funnel title="Ready-to-wear" steps={data.rtwFunnel} />
        <Funnel title="Atelier" steps={data.atelierFunnel} />
      </div>

      <Traffic rows={data.traffic} note={data.gloryNote} />
      <Looked rows={data.lookedNotBought} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-opaque p-5">
          <h2 className="font-display text-lg text-choc">Already on the books</h2>
          <ul className="mt-3 space-y-2 font-sans text-sm text-[#6B6B68]">
            <li>
              Abandoned checkouts: {data.abandoned.sessions.toLocaleString("en-NG")} open, {naira(data.abandoned.valueNGN)}
            </li>
            <li>
              Email: {data.email.sent} sent, {data.email.failed} failed, {data.email.dead} dead
            </li>
            <li>
              Points: {data.points.issued.toLocaleString("en-NG")} issued, {data.points.redeemed.toLocaleString("en-NG")} redeemed,{" "}
              {data.points.outstanding.toLocaleString("en-NG")} outstanding
            </li>
          </ul>
        </div>
        <div className="glass-opaque p-5">
          <h2 className="font-display text-lg text-choc">Where gowns sit</h2>
          {data.atelierStages.length === 0 ? (
            <p className="mt-3 font-sans text-sm text-[#6B6B68]">No live commissions.</p>
          ) : (
            <ul className="mt-3 space-y-2 font-sans text-sm">
              {data.atelierStages.map((s) => (
                <li key={s.stage} className="flex items-baseline justify-between gap-3">
                  <span className="capitalize text-choc">{s.stage}</span>
                  <span className="text-[#6B6B68]">
                    {s.count} · {s.avgDays} days
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="font-sans text-[11px] text-[#6B6B68]">
        Page counts are first-party totals, not people. Daily detail is kept {data.retentionDays} days, then monthly
        totals. No visitor id is stored.
      </p>
    </div>
  );
}
