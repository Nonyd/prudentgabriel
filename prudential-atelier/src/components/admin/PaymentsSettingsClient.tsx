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

const COMMERCIAL_ORDER = [
  "paystack_enabled",
  "flutterwave_enabled",
  "stripe_enabled",
  "monnify_enabled",
  "bespoke_deposit_percent",
  "alteration_warranty_days",
  "exchange_rate_usd",
  "exchange_rate_gbp",
];

export function PaymentsSettingsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [gateways, setGateways] = useState<GatewayAdminStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/PAYMENTS");
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as { items: Row[]; gateways?: GatewayAdminStatus[] };
      setRows(data.items);
      setGateways(data.gateways ?? []);
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
  const extra = rows.filter((r) => !COMMERCIAL_ORDER.includes(r.key) && !r.key.startsWith("bank_"));

  if (loading) {
    return <p className="font-body text-sm text-[#6B6B68]">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <p className="font-body text-sm text-[#6B6B68]">
        Turn gateways on or off, set deposit and currency overrides. API keys live on{" "}
        <Link href="/admin/settings/developer" className="underline">
          Developer settings
        </Link>
        .
      </p>

      <section className="space-y-3">
        <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-[#6B6B68]">
          Checkout gateways
        </h2>
        <ul className="space-y-3">
          {gateways.map((gw) => {
            const checkoutShows = gw.enabled && gw.configured;
            return (
              <li key={gw.id} className="border border-sand bg-canvas px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-body text-sm font-medium text-ink">{gw.label}</p>
                  <p className="font-body text-xs uppercase tracking-wider text-[#6B6B68]">
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
                  <p className="mt-2 font-body text-sm text-[#6B6B68]">Credentials present.</p>
                ) : (
                  <p className="mt-2 font-body text-sm text-[#6B6B68]">
                    Credentials present. Turn the gateway on below if you want it at checkout.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <p className="font-body text-sm text-[#6B6B68]">
        Bank transfer accounts, fee bearer, and tolerance:{" "}
        <a href="/admin/settings/bank-accounts" className="underline">
          Bank accounts
        </a>
        .
      </p>

      <SettingsCommercialCard rows={[...commercialRows, ...extra]} onSaved={load} />
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
      <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-[#6B6B68]">
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
        className="mt-8 h-10 w-full bg-[#37392d] font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save payments"}
      </button>
    </div>
  );
}
