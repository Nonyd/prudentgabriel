"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import type { SettingGroup, SettingType } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { FieldInput } from "@/components/admin/AdminSettingsClient";
import { ENV_SOURCE_LABEL } from "@/lib/credential-catalog";

type SettingRow = {
  key: string;
  value: string;
  label: string;
  type: SettingType;
  isPublic?: boolean;
  sortOrder?: number;
  source?: "database" | "environment" | "unset";
};

type EnvStatus = {
  databaseUrl: boolean;
  authSecret: boolean;
  appUrl: boolean;
  encryption: boolean;
  cloudinary: boolean;
  cronSecret: boolean;
  googleOauth: boolean;
};

const WEBHOOK_BASE = `${(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")}/api/payment`;

const GATEWAYS = [
  {
    id: "paystack" as const,
    title: "Paystack",
    publicKey: "paystack_public_key",
    secretKey: "paystack_secret_key",
    publicLabel: "Public key",
    secretLabel: "Secret key",
  },
  {
    id: "flutterwave" as const,
    title: "Flutterwave",
    publicKey: "flutterwave_public_key",
    secretKey: "flutterwave_secret_key",
    publicLabel: "Public key",
    secretLabel: "Secret key",
    extraKeys: [{ key: "flutterwave_secret_hash", label: "Webhook hash (verif-hash)" }],
  },
  {
    id: "stripe" as const,
    title: "Stripe",
    publicKey: "stripe_public_key",
    secretKey: "stripe_secret_key",
    publicLabel: "Publishable key",
    secretLabel: "Secret key",
    extraKeys: [{ key: "stripe_webhook_secret", label: "Webhook signing secret" }],
  },
  {
    id: "monnify" as const,
    title: "Monnify",
    publicKey: "monnify_api_key",
    secretKey: "monnify_secret_key",
    publicLabel: "API key",
    secretLabel: "Secret key",
    extraKeys: [
      { key: "monnify_contract_code", label: "Contract code" },
      { key: "monnify_environment", label: "Environment" },
    ],
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

function EnvPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center justify-between border border-sand px-4 py-2 font-sans text-sm">
      <span>{label}</span>
      <span className="text-xs uppercase tracking-wider text-text-mid">{ok ? "Configured" : "Not set"}</span>
    </li>
  );
}

function CredentialInput({
  row,
  onChange,
}: {
  row: SettingRow & { isPublic: boolean; sortOrder: number };
  onChange: (v: string) => void;
}) {
  return (
    <div>
      {row.source === "environment" ? (
        <p className="mb-2 rounded-md border border-nut/40 bg-[#FFF8F0] px-3 py-2 font-sans text-xs text-text-dark">
          {ENV_SOURCE_LABEL}. Mail and payments will not use it until it is saved here.
        </p>
      ) : null}
      <FieldInput row={row} onChange={onChange} />
    </div>
  );
}

export function DeveloperSettingsClient() {
  const [items, setItems] = useState<SettingRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [emailTesting, setEmailTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/developer");
      if (!res.ok) throw new Error("Failed to load settings");
      const data = (await res.json()) as {
        items: SettingRow[];
        env: EnvStatus;
        groups?: Partial<Record<SettingGroup, SettingRow[]>>;
      };
      setItems(data.items);
      setEnv(data.env);
      const map: Record<string, string> = {};
      for (const r of data.items) map[r.key] = r.value;
      setDraft(map);
    } catch {
      toast.error("Could not load developer settings");
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
      const base = items.find((r) => r.key === key);
      const raw = draft[key] ?? "";
      const source = base?.source;
      return {
        key,
        label: base?.label ?? key,
        type: base?.type ?? "TEXT",
        value: raw === ENV_SOURCE_LABEL ? "" : raw,
        source,
        isPublic: base?.isPublic ?? false,
        sortOrder: base?.sortOrder ?? 0,
      };
    },
    [items, draft],
  );

  const envOnlyCount = items.filter((r) => r.source === "environment").length;

  const adoptFromEnv = async () => {
    setAdopting(true);
    try {
      const res = await fetch("/api/admin/settings/developer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adoptFromEnv: true }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; adopted?: string[] };
      if (!res.ok) throw new Error(j.error ?? "Could not copy environment keys");
      const n = j.adopted?.length ?? 0;
      toast.success(n ? `Saved ${n} key${n === 1 ? "" : "s"} from the server environment` : "Nothing to copy");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not copy environment keys");
    } finally {
      setAdopting(false);
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(draft)
        .filter(([key]) => items.some((i) => i.key === key))
        .map(([key, value]) => ({ key, value }));
      const res = await fetch("/api/admin/settings/developer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      toast.success("Developer settings saved");
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-20 text-text-mid">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="font-sans text-sm">Loading developer settings…</span>
      </div>
    );
  }

  const emailKeys = [
    "email_provider",
    "email_provider_order",
    "resend_api_key",
    "brevo_api_key",
    "smtp_host",
    "smtp_port",
    "smtp_username",
    "smtp_password",
    "smtp_use_ssl",
  ];
  const smsKeys = ["sms_api_key"];
  const slackKeys = ["slack_webhook_url"];
  const shippingKeys = ["gig_api_key", "gig_wallet_id", "dhl_site_id", "dhl_password", "dhl_account_number"];

  return (
    <div className="space-y-8">
        <div>
        <p className="eyebrow">Super Admin</p>
        <h1 className="mt-2 font-serif text-2xl font-medium text-choc">Developer Settings</h1>
        <p className="mt-2 font-sans text-sm font-light text-text-mid">
          Credentials only. Gateway on/off, deposit, and bank accounts are on{" "}
          <a href="/admin/settings/payments" className="underline">
            Payments
          </a>
          . Secret keys are AES-256-GCM encrypted at rest. The database is the source of truth —
          an empty field here means the app does not have the key.
        </p>
      </div>

      {envOnlyCount > 0 ? (
        <div className="border border-nut/40 bg-[#FFF8F0] px-4 py-3">
          <p className="font-sans text-sm text-text-dark">
            {envOnlyCount} credential{envOnlyCount === 1 ? " is" : "s are"} set on the server and empty in the
            dashboard. That used to send mail and take payments while this page looked blank.
          </p>
          <Button type="button" className="mt-3" variant="ghost-light" loading={adopting} onClick={() => void adoptFromEnv()}>
            Save environment keys into the dashboard
          </Button>
        </div>
      ) : null}

      <section className="card-surface p-6">
        <h2 className="font-serif text-lg font-medium text-choc">Payment gateways</h2>
        <div className="mt-8 space-y-8">
          {GATEWAYS.map((gw) => (
            <div key={gw.id} className="rounded-md border border-sand bg-bg/30 p-5">
              <h3 className="font-serif text-base font-medium text-choc">{gw.title}</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block font-sans text-xs text-text-mid">{gw.publicLabel}</label>
                  <CredentialInput row={rowFor(gw.publicKey)} onChange={(v) => setValue(gw.publicKey, v)} />
                </div>
                <div>
                  <label className="mb-1 block font-sans text-xs text-text-mid">{gw.secretLabel}</label>
                  <CredentialInput row={rowFor(gw.secretKey)} onChange={(v) => setValue(gw.secretKey, v)} />
                </div>
                {gw.extraKeys?.map((extra) => (
                  <div key={extra.key} className="md:col-span-2 md:max-w-md">
                    <label className="mb-1 block font-sans text-xs text-text-mid">{extra.label}</label>
                    <CredentialInput row={rowFor(extra.key)} onChange={(v) => setValue(extra.key, v)} />
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
        <h2 className="font-serif text-lg font-medium text-choc">Email, SMS, Slack</h2>
        <p className="mt-1 font-sans text-xs text-text-mid">
          From-name and reply-to stay on{" "}
          <a href="/admin/settings/email" className="underline">
            Email settings
          </a>
          . Templates are under{" "}
          <a href="/admin/content/email-templates" className="underline">
            Content
          </a>
          .
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[...emailKeys, ...smsKeys, ...slackKeys].map((key) => (
            <div key={key} className={key === "smtp_password" || key === "slack_webhook_url" ? "md:col-span-2" : ""}>
              <label className="mb-1 block font-sans text-xs text-text-mid">{rowFor(key).label}</label>
              <CredentialInput row={rowFor(key)} onChange={(v) => setValue(key, v)} />
            </div>
          ))}
        </div>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-serif text-lg font-medium text-choc">Shipping carriers</h2>
        <p className="mt-1 font-sans text-xs text-text-mid">
          Manual vs live mode is on{" "}
          <a href="/admin/shipping" className="underline">
            Shipping
          </a>
          .
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {shippingKeys.map((key) => (
            <div key={key}>
              <label className="mb-1 block font-sans text-xs text-text-mid">{rowFor(key).label}</label>
              <CredentialInput row={rowFor(key)} onChange={(v) => setValue(key, v)} />
            </div>
          ))}
        </div>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-serif text-lg font-medium text-choc">Live exchange rates</h2>
        <p className="mt-1 font-sans text-xs text-text-mid">
          Open Exchange Rates app ID. Manual ₦ overlay rates stay on{" "}
          <a href="/admin/settings/payments" className="underline">
            Payments
          </a>
          .
        </p>
        <div className="mt-6 max-w-md">
          <label className="mb-1 block font-sans text-xs text-text-mid">
            {rowFor("open_exchange_rates_app_id").label}
          </label>
          <CredentialInput
            row={rowFor("open_exchange_rates_app_id")}
            onChange={(v) => setValue("open_exchange_rates_app_id", v)}
          />
        </div>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-serif text-lg font-medium text-choc">Host environment</h2>
        <p className="mt-1 font-sans text-xs text-text-mid">
          These cannot live in the database. Status only.
        </p>
        <ul className="mt-4 space-y-2">
          <EnvPill ok={Boolean(env?.databaseUrl)} label="DATABASE_URL" />
          <EnvPill ok={Boolean(env?.authSecret)} label="AUTH_SECRET / NEXTAUTH_SECRET" />
          <EnvPill ok={Boolean(env?.appUrl)} label="NEXTAUTH_URL / APP_URL" />
          <EnvPill ok={Boolean(env?.encryption)} label="Settings encryption key" />
          <EnvPill ok={Boolean(env?.cloudinary)} label="Cloudinary" />
          <EnvPill ok={Boolean(env?.cronSecret)} label="CRON_SECRET" />
          <EnvPill ok={Boolean(env?.googleOauth)} label="Google OAuth" />
        </ul>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-serif text-lg font-medium text-choc">Save &amp; test</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" loading={saving} onClick={() => void saveAll()}>
            Save credentials
          </Button>
          <Button type="button" variant="ghost-light" loading={emailTesting} onClick={() => void handleTestEmail()}>
            Send test email
          </Button>
        </div>
      </section>
    </div>
  );
}
