"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import type { SettingType } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { FieldInput, patchGroup } from "@/components/admin/AdminSettingsClient";

type SettingRow = { key: string; value: string; label: string; type: SettingType; isPublic?: boolean; sortOrder?: number };

const WEBHOOK_BASE = `${(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")}/api/payment`;

const GATEWAYS = [
  {
    id: "paystack" as const,
    title: "Paystack",
    enabledKey: "paystack_enabled",
    publicKey: "paystack_public_key",
    secretKey: "paystack_secret_key",
    publicLabel: "Public key",
    secretLabel: "Secret key",
  },
  {
    id: "flutterwave" as const,
    title: "Flutterwave",
    enabledKey: "flutterwave_enabled",
    publicKey: "flutterwave_public_key",
    secretKey: "flutterwave_secret_key",
    publicLabel: "Public key",
    secretLabel: "Secret key",
  },
  {
    id: "stripe" as const,
    title: "Stripe",
    enabledKey: "stripe_enabled",
    publicKey: "stripe_public_key",
    secretKey: "stripe_secret_key",
    publicLabel: "Publishable key",
    secretLabel: "Secret key",
    extraKeys: [{ key: "stripe_webhook_secret", label: "Webhook signing secret" }],
  },
  {
    id: "monnify" as const,
    title: "Monnify",
    enabledKey: "monnify_enabled",
    publicKey: "monnify_api_key",
    secretKey: "monnify_secret_key",
    publicLabel: "API key",
    secretLabel: "Secret key",
    extraKeys: [{ key: "monnify_contract_code", label: "Contract code" }],
  },
];

function WebhookUrl({ gateway }: { gateway: string }) {
  const url = `${WEBHOOK_BASE}/${gateway}/webhook`;

  return (
    <div className="mt-4">
      <p className="font-sans text-xs text-text-mid">Webhook URL</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border border-sand bg-bg/60 px-3 py-2 font-mono text-xs text-text-dark">
          {url}
        </code>
        <button
          type="button"
          className="rounded-md border border-sand p-2 text-text-mid hover:bg-bg/80"
          aria-label="Copy webhook URL"
          onClick={() => {
            void navigator.clipboard.writeText(url);
            toast.success("Webhook URL copied");
          }}
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function DeveloperSettingsClient() {
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [emailTesting, setEmailTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/PAYMENTS");
      if (!res.ok) throw new Error("Failed to load settings");
      const data = (await res.json()) as { items: SettingRow[] };
      setRows(data.items);
      const map: Record<string, string> = {};
      for (const r of data.items) map[r.key] = r.value;
      setDraft(map);
    } catch {
      toast.error("Could not load payment settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setValue = (key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const rowFor = useCallback(
    (key: string): SettingRow & { isPublic: boolean; sortOrder: number } => {
      const base = rows.find((r) => r.key === key);
      return {
        key,
        label: base?.label ?? key,
        type: base?.type ?? "TEXT",
        value: draft[key] ?? "",
        isPublic: base?.isPublic ?? false,
        sortOrder: base?.sortOrder ?? 0,
      };
    },
    [rows, draft],
  );

  const saveAll = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(draft).map(([key, value]) => ({ key, value }));
      await patchGroup("PAYMENTS", updates);
      toast.success("Payment settings saved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const testGateway = async (gateway: (typeof GATEWAYS)[number]["id"]) => {
    setTesting(gateway);
    try {
      const res = await fetch("/api/admin/settings/test-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (data.ok) toast.success(data.message ?? "Connection successful");
      else toast.error(data.message ?? "Connection failed");
    } catch {
      toast.error("Connection test failed");
    } finally {
      setTesting(null);
    }
  };

  const handleTestEmail = async () => {
    setEmailTesting(true);
    try {
      const res = await fetch("/api/admin/emails/test", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Test email sent");
    } catch {
      toast.error("Could not send test email");
    } finally {
      setEmailTesting(false);
    }
  };

  const bankFields = useMemo(
    () => ["bank_name", "bank_account_number", "bank_account_name"] as const,
    [],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-20 text-text-mid">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="font-sans text-sm">Loading developer settings…</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Super Admin</p>
        <h1 className="mt-2 font-serif text-2xl font-medium text-choc">Developer Settings</h1>
        <p className="mt-2 font-sans text-sm font-light text-text-mid">
          Payment gateways, bank transfer details, and exchange rates. Secret keys are AES-256-GCM encrypted at rest.
        </p>
      </div>

      <section className="card-surface p-6">
        <h2 className="font-serif text-lg font-medium text-choc">Payment gateways</h2>
        <p className="mt-1 font-sans text-xs text-text-mid">
          Credentials are read from SiteSetting at runtime, with env var fallback during migration.
        </p>

        <div className="mt-8 space-y-8">
          {GATEWAYS.map((gw) => (
            <div key={gw.id} className="rounded-md border border-sand bg-bg/30 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-serif text-base font-medium text-choc">{gw.title}</h3>
                <label className="flex items-center gap-2 font-sans text-sm text-text-dark">
                  <input
                    type="checkbox"
                    checked={draft[gw.enabledKey] === "true"}
                    onChange={(e) => setValue(gw.enabledKey, e.target.checked ? "true" : "false")}
                    className="h-4 w-4 accent-nut"
                  />
                  Enabled
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block font-sans text-xs text-text-mid">{gw.publicLabel}</label>
                  <FieldInput row={rowFor(gw.publicKey)} onChange={(v) => setValue(gw.publicKey, v)} />
                </div>
                <div>
                  <label className="mb-1 block font-sans text-xs text-text-mid">{gw.secretLabel}</label>
                  <FieldInput row={rowFor(gw.secretKey)} onChange={(v) => setValue(gw.secretKey, v)} />
                </div>
                {gw.extraKeys?.map((extra) => (
                  <div key={extra.key} className="md:col-span-2 md:max-w-md">
                    <label className="mb-1 block font-sans text-xs text-text-mid">{extra.label}</label>
                    <FieldInput row={rowFor(extra.key)} onChange={(v) => setValue(extra.key, v)} />
                  </div>
                ))}
              </div>

              <WebhookUrl gateway={gw.id} />

              <div className="mt-4">
                <Button
                  type="button"
                  variant="ghost-light"
                  loading={testing === gw.id}
                  onClick={() => void testGateway(gw.id)}
                >
                  Test connection
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-serif text-lg font-medium text-choc">Bank transfer</h2>
        <p className="mt-1 font-sans text-xs text-text-mid">Shown to customers who pay by direct bank transfer.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {bankFields.map((key) => (
            <div key={key}>
              <label className="mb-1 block font-sans text-xs text-text-mid">{rowFor(key).label}</label>
              <FieldInput row={rowFor(key)} onChange={(v) => setValue(key, v)} />
            </div>
          ))}
        </div>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-serif text-lg font-medium text-choc">Exchange rates</h2>
        <p className="mt-1 font-sans text-xs text-text-mid">
          Manual rates per ₦1 (e.g. USD 0.00065 means ₦1 = $0.00065). Overrides Open Exchange Rates when set.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {(["exchange_rate_usd", "exchange_rate_gbp"] as const).map((key) => (
            <div key={key}>
              <label className="mb-1 block font-sans text-xs text-text-mid">{rowFor(key).label}</label>
              <FieldInput row={rowFor(key)} onChange={(v) => setValue(key, v)} />
            </div>
          ))}
        </div>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-serif text-lg font-medium text-choc">System utilities</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" loading={saving} onClick={() => void saveAll()}>
            Save payment settings
          </Button>
          <Button type="button" variant="ghost-light" loading={emailTesting} onClick={() => void handleTestEmail()}>
            Send test email
          </Button>
        </div>
      </section>
    </div>
  );
}
