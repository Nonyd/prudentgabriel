"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { SettingType } from "@prisma/client";
import { FieldInput, patchGroup } from "@/components/admin/AdminSettingsClient";

type GatewayAdminStatus = {
  id: "paystack" | "flutterwave" | "stripe" | "monnify";
  label: string;
  enabled: boolean;
  configured: boolean;
  missing: string[];
};

type Row = {
  key: string;
  value: string;
  label: string;
  type: SettingType;
  isPublic: boolean;
  sortOrder: number;
};

type FxStatus = {
  appIdSet: boolean;
  source: "openexchangerates" | "manual_rate" | "hardcoded_fallback";
  ngnPerUsd: number | null;
  ngnPerGbp: number | null;
  fetchedAt: string;
};

const FX_SOURCE_LABEL: Record<FxStatus["source"], string> = {
  openexchangerates: "Live rate from Open Exchange Rates",
  manual_rate: "Your manual rates",
  hardcoded_fallback: "Built-in fallback rates (set manual rates or turn on live)",
};

const FX_KEYS = ["fx_use_live_rates", "exchange_rate_usd", "exchange_rate_gbp"];

const COMMERCIAL_ORDER = [
  "paystack_enabled",
  "flutterwave_enabled",
  "stripe_enabled",
  "monnify_enabled",
  "bespoke_deposit_percent",
  "alteration_warranty_days",
];

export function PaymentsSettingsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [gateways, setGateways] = useState<GatewayAdminStatus[]>([]);
  const [fx, setFx] = useState<FxStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/PAYMENTS");
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as { items: Row[]; gateways?: GatewayAdminStatus[]; fx?: FxStatus };
      setRows(data.items);
      setGateways(data.gateways ?? []);
      setFx(data.fx ?? null);
    } catch {
      toast.error("Could not load payment settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const commercialRows = COMMERCIAL_ORDER.map((key) => rows.find((r) => r.key === key)).filter(
    (r): r is Row => Boolean(r),
  );
  const extra = rows.filter(
    (r) => !COMMERCIAL_ORDER.includes(r.key) && !FX_KEYS.includes(r.key) && !r.key.startsWith("bank_"),
  );
  const fxRows = FX_KEYS.map((key) => rows.find((r) => r.key === key)).filter((r): r is Row => Boolean(r));

  if (loading) {
    return <p className="font-body text-sm text-text-mid">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <p className="font-body text-sm text-text-mid">
        Turn gateways on or off, set deposit and currency overrides. API keys live on{" "}
        <Link href="/admin/settings/developer" className="underline">
          Developer settings
        </Link>
        .
      </p>

      <section className="space-y-3">
        <h2 className="font-body text-11px font-medium uppercase tracking-[0.14em] text-text-mid">
          Checkout gateways
        </h2>
        <ul className="space-y-3">
          {gateways.map((gw) => {
            const checkoutShows = gw.enabled && gw.configured;
            return (
              <li key={gw.id} className="border border-sand bg-canvas px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-body text-sm font-medium text-ink">{gw.label}</p>
                  <p className="font-body text-xs uppercase tracking-wider text-text-mid">
                    {checkoutShows
                      ? "Appears at checkout"
                      : gw.enabled
                        ? "Enabled — not configured"
                        : "Off"}
                  </p>
                </div>
                {!gw.configured ? (
                  <p className="mt-2 font-body text-sm text-ink">
                    Keys are missing ({gw.missing.join(", ")}). Ask Nony to add them in Developer
                    settings — toggling this on will not take payments until those are set.
                  </p>
                ) : gw.enabled ? (
                  <p className="mt-2 font-body text-sm text-text-mid">Credentials present.</p>
                ) : (
                  <p className="mt-2 font-body text-sm text-text-mid">
                    Credentials present. Turn the gateway on below if you want it at checkout.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <p className="font-body text-sm text-text-mid">
        Bank transfer accounts, fee bearer, and tolerance:{" "}
        <Link href="/admin/settings/bank-accounts" className="underline">
          Bank accounts
        </Link>
        .
      </p>

      {fxRows.length ? <ExchangeRatesCard rows={fxRows} status={fx} onSaved={load} /> : null}

      <SettingsCommercialCard rows={[...commercialRows, ...extra]} onSaved={load} />
    </div>
  );
}

/** Live or manual exchange rates, with what the shop is pricing with right now. */
function ExchangeRatesCard({ rows, status, onSaved }: { rows: Row[]; status: FxStatus | null; onSaved: () => void }) {
  const [local, setLocal] = useState(rows);
  const [saving, setSaving] = useState(false);
  useEffect(() => setLocal(rows), [rows]);

  const value = (key: string) => local.find((r) => r.key === key)?.value ?? "";
  const set = (key: string, v: string) => setLocal((prev) => prev.map((r) => (r.key === key ? { ...r, value: v } : r)));
  const live = value("fx_use_live_rates") === "true";
  const perNaira = (key: string) => {
    const n = Number(value(key));
    return Number.isFinite(n) && n > 0 ? Math.round(1 / n).toLocaleString("en-NG") : "—";
  };

  const save = async () => {
    setSaving(true);
    try {
      await patchGroup(
        "PAYMENTS",
        local.map((r) => ({ key: r.key, value: r.value })),
      );
      toast.success("Exchange rates saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const choice = (on: boolean, title: string, body: string) => (
    <label className={`flex cursor-pointer gap-3 border px-4 py-3 ${live === on ? "border-choc bg-bg-surface" : "border-sand"}`}>
      <input
        type="radio"
        name="fx-mode"
        checked={live === on}
        onChange={() => set("fx_use_live_rates", on ? "true" : "false")}
        className="mt-1"
      />
      <span>
        <span className="block font-body text-sm font-medium text-ink">{title}</span>
        <span className="block font-body text-xs text-text-mid">{body}</span>
      </span>
    </label>
  );

  return (
    <div className="border border-sand bg-canvas p-6">
      <h2 className="font-body text-11px font-medium uppercase tracking-[0.14em] text-text-mid">Exchange rates</h2>
      <p className="mt-2 font-body text-sm text-text-mid">
        Prices are set in naira. Dollar and pound prices use the rate below, locked on each order when the client
        checks out.
      </p>

      {status ? (
        <p className="mt-4 border border-sand bg-bg-surface px-4 py-3 font-body text-sm text-ink">
          <span className="block text-xs uppercase tracking-[0.1em] text-text-mid">In use now</span>
          {FX_SOURCE_LABEL[status.source]}: ₦{status.ngnPerUsd?.toLocaleString("en-NG") ?? "—"} = $1 · ₦
          {status.ngnPerGbp?.toLocaleString("en-NG") ?? "—"} = £1
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        {choice(
          true,
          "Use live rates (Open Exchange Rates)",
          "Updated every hour (about 720 requests a month, inside the free plan's 1,000). If the service cannot be reached, your manual rates below are used instead.",
        )}
        {choice(false, "Use my manual rates", "The shop always uses the two rates below until you change them.")}
      </div>

      {live && status && !status.appIdSet ? (
        <p className="mt-3 font-body text-sm text-error">
          No Open Exchange Rates app ID is saved yet, so the manual rates are still in use. Add it in{" "}
          <Link href="/admin/settings/developer" className="underline">
            Developer settings
          </Link>
          .
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {(["exchange_rate_usd", "exchange_rate_gbp"] as const).map((key) => (
          <div key={key}>
            <label className="font-body text-xs text-charcoal" htmlFor={key}>
              {key === "exchange_rate_usd" ? "Manual: US dollars per ₦1" : "Manual: pounds per ₦1"}
            </label>
            <input
              id={key}
              inputMode="decimal"
              value={value(key)}
              onChange={(e) => set(key, e.target.value)}
              className="mt-1.5 w-full border border-input-border bg-input-bg px-3 py-2 font-body text-sm text-ink"
            />
            <p className="mt-1 font-body text-xs text-text-mid">
              = ₦{perNaira(key)} per {key === "exchange_rate_usd" ? "$1" : "£1"}
              {live ? " · used only if the live rate is unavailable" : ""}
            </p>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="mt-6 h-10 w-full bg-[#37392d] font-body text-11px font-medium uppercase tracking-[0.12em] text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save exchange rates"}
      </button>
    </div>
  );
}

function SettingsCommercialCard({ rows, onSaved }: { rows: Row[]; onSaved: () => void }) {
  const [local, setLocal] = useState(rows);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal(rows);
  }, [rows]);

  const save = async () => {
    setSaving(true);
    try {
      await patchGroup(
        "PAYMENTS",
        local.map((r) => ({ key: r.key, value: r.value })),
      );
      toast.success("Payments saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-sand bg-canvas p-6">
      <h2 className="font-body text-11px font-medium uppercase tracking-[0.14em] text-text-mid">
        Commercial
      </h2>
      <div className="mt-6 space-y-5">
        {local.map((row) => (
          <div key={row.key}>
            <label className="font-body text-xs text-charcoal">{row.label}</label>
            <div className="mt-1.5">
              <FieldInput row={row} onChange={(v) => setLocal((prev) => prev.map((r) => (r.key === row.key ? { ...r, value: v } : r)))} />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="mt-8 h-10 w-full bg-[#37392d] font-body text-11px font-medium uppercase tracking-[0.12em] text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save payments"}
      </button>
    </div>
  );
}
