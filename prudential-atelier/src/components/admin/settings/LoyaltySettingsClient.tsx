"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type RuleRow = {
  action: string;
  label: string;
  points: number;
  isActive: boolean;
  nairaEach: number;
  referralsForSample: number | null;
  spendNote: string | null;
};

type HistoryRow = {
  id: string;
  rateNGN: number;
  previousRateNGN: number | null;
  outstandingPoints: number;
  liabilityNGN: number;
  changedBy: string;
  createdAt: string;
};

type Payload = {
  rateNGN: number;
  minRedemption: number;
  expiryMonths: number;
  copy: string;
  outstandingPoints: number;
  liabilityNGN: number;
  sampleGarmentNGN: number;
  rules: RuleRow[];
  history: HistoryRow[];
};

function naira(n: number) {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

export function LoyaltySettingsClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [rate, setRate] = useState("1");
  const [minRedemption, setMinRedemption] = useState("5000");
  const [expiryMonths, setExpiryMonths] = useState("24");
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmRate, setConfirmRate] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/loyalty");
    if (!res.ok) return;
    const j = (await res.json()) as Payload;
    setData(j);
    setRate(String(j.rateNGN));
    setMinRedemption(String(j.minRedemption));
    setExpiryMonths(String(j.expiryMonths));
    setRules(j.rules);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) {
    return <p className="font-body text-sm text-[#6B6B68]">Loading…</p>;
  }

  const nextRate = Number.parseFloat(rate);
  const rateChanging = Number.isFinite(nextRate) && nextRate > 0 && nextRate !== data.rateNGN;
  const nextLiability = rateChanging ? data.outstandingPoints * nextRate : data.liabilityNGN;

  const save = async () => {
    if (rateChanging && !confirmRate) {
      setConfirmRate(true);
      toast.error("Read the revaluation warning, then save again to confirm.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/loyalty", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rateNGN: nextRate,
          minRedemption: Number.parseInt(minRedemption, 10) || 0,
          expiryMonths: Number.parseInt(expiryMonths, 10) || 24,
          rules: rules.map((r) => ({ action: r.action, points: r.points, isActive: r.isActive })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "Save failed");
      toast.success("Prudent Points settings saved");
      setConfirmRate(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-sm border border-sand bg-canvas p-6">
        <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-[#6B6B68]">
          Prudent Points liability
        </h2>
        <p className="mt-3 font-display text-3xl text-choc">{naira(data.liabilityNGN)}</p>
        <p className="mt-1 font-body text-sm text-[#6B6B68]">
          {data.outstandingPoints.toLocaleString()} points outstanding × {naira(data.rateNGN)} each. This is a
          balance-sheet liability. Each award expires after {data.expiryMonths} months.
        </p>
        <p className="mt-4 font-body text-sm text-choc">{data.copy}</p>
      </div>

      <div className="rounded-sm border border-sand bg-canvas p-6">
        <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-[#6B6B68]">
          Point value
        </h2>
        <label className="mt-4 block font-body text-xs text-charcoal">Naira worth of one point</label>
        <input
          type="number"
          min={0.01}
          step="0.01"
          value={rate}
          onChange={(e) => {
            setRate(e.target.value);
            setConfirmRate(false);
          }}
          className="mt-1.5 w-full max-w-xs border border-sand bg-ivory px-3 py-2 font-body text-sm"
        />
        {rateChanging ? (
          <div className="mt-4 border border-[#92660A] bg-[#92660A]/10 p-4 font-body text-sm text-choc">
            <p className="font-medium">Changing this rate revalues every outstanding balance.</p>
            <p className="mt-2">
              {data.outstandingPoints.toLocaleString()} points × {naira(nextRate)} ={" "}
              <strong>{naira(nextLiability)}</strong> (now {naira(data.liabilityNGN)}). Halving the rate halves
              what every customer can spend. Past orders keep the rate locked at redemption.
            </p>
            {confirmRate ? (
              <p className="mt-2 text-[#92660A]">Press Save again to record this change.</p>
            ) : null}
          </div>
        ) : null}

        <label className="mt-6 block font-body text-xs text-charcoal">Minimum redemption (points)</label>
        <input
          type="number"
          min={0}
          step="1"
          value={minRedemption}
          onChange={(e) => setMinRedemption(e.target.value)}
          className="mt-1.5 w-full max-w-xs border border-sand bg-ivory px-3 py-2 font-body text-sm"
        />
        <p className="mt-1 font-body text-[12px] text-[#6B6B68]">
          Stops small checkouts. Points still cannot cover shipping. There is no maximum — points may cover 100% of
          the garment.
        </p>

        <label className="mt-6 block font-body text-xs text-charcoal">Expiry (months from each award)</label>
        <input
          type="number"
          min={1}
          step="1"
          value={expiryMonths}
          onChange={(e) => setExpiryMonths(e.target.value)}
          className="mt-1.5 w-full max-w-xs border border-sand bg-ivory px-3 py-2 font-body text-sm"
        />
      </div>

      <div className="rounded-sm border border-sand bg-canvas p-6">
        <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-[#6B6B68]">
          Earning — what the rules cost in garments
        </h2>
        <p className="mt-2 font-body text-sm text-[#6B6B68]">
          Unlimited redemption means every earning rule is a commitment of inventory. A {naira(data.sampleGarmentNGN)}{" "}
          dress at the current rate:
        </p>
        <div className="mt-6 space-y-5">
          {rules.map((r) => (
            <div key={r.action} className="border-t border-sand pt-4 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-body text-sm text-choc">{r.label}</p>
                <label className="flex items-center gap-2 font-body text-xs text-[#6B6B68]">
                  <input
                    type="checkbox"
                    checked={r.isActive}
                    onChange={(e) =>
                      setRules((prev) =>
                        prev.map((row) => (row.action === r.action ? { ...row, isActive: e.target.checked } : row)),
                      )
                    }
                  />
                  Active
                </label>
              </div>
              <div className="mt-2 flex flex-wrap items-end gap-4">
                <div>
                  <label className="font-body text-xs text-charcoal">Points</label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={r.points}
                    onChange={(e) =>
                      setRules((prev) =>
                        prev.map((row) =>
                          row.action === r.action ? { ...row, points: Number.parseInt(e.target.value, 10) || 0 } : row,
                        ),
                      )
                    }
                    className="mt-1 block w-28 border border-sand bg-ivory px-3 py-2 font-body text-sm"
                  />
                </div>
                <p className="mb-2 font-body text-sm text-[#6B6B68]">
                  = {naira(r.nairaEach)}
                  {r.referralsForSample != null
                    ? ` · ${r.referralsForSample} first paid referrals for a ${naira(data.sampleGarmentNGN)} dress`
                    : ""}
                </p>
                {r.spendNote ? <p className="font-body text-xs text-[#6B6B68]">{r.spendNote}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="h-10 w-full bg-[#37392d] font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : confirmRate ? "Confirm rate change" : "Save Prudent Points"}
      </button>

      {data.history.length > 0 ? (
        <div className="rounded-sm border border-sand bg-canvas p-6">
          <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-[#6B6B68]">
            Rate history
          </h2>
          <ul className="mt-4 space-y-2 font-body text-sm text-charcoal">
            {data.history.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 border-b border-sand/60 py-2">
                <span>
                  {naira(h.previousRateNGN ?? 0)} → {naira(h.rateNGN)} · {h.changedBy}
                </span>
                <span className="text-[#6B6B68]">
                  {new Date(h.createdAt).toLocaleString()} · liability {naira(h.liabilityNGN)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
