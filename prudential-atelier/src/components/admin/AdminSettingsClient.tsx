"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Accordion from "@radix-ui/react-accordion";
import toast from "react-hot-toast";
import type { SettingGroup, SettingType } from "@prisma/client";
import { AppearanceSettingsCard } from "@/components/admin/settings/AppearanceSettingsCard";
import { EmailTemplatesEditor } from "@/components/admin/settings/EmailTemplatesEditor";
import { MediaLibraryTab } from "@/components/admin/settings/MediaLibraryTab";

type Row = {
  key: string;
  value: string;
  label: string;
  type: SettingType;
  isPublic: boolean;
  sortOrder: number;
};

const PASSWORD_MASK = "••••••••";

const TABS: { id: string; label: string; groups: SettingGroup[] }[] = [
  { id: "store", label: "Store", groups: ["STORE"] },
  { id: "payments", label: "Payments", groups: ["PAYMENTS"] },
  { id: "email", label: "Email & SMS", groups: ["EMAIL", "SMS"] },
  { id: "appearance", label: "Appearance", groups: ["APPEARANCE"] },
  { id: "social", label: "Social", groups: ["SOCIAL"] },
  { id: "loyalty", label: "Loyalty", groups: ["LOYALTY"] },
  { id: "notifications", label: "Notifications", groups: ["NOTIFICATIONS"] },
  { id: "seo", label: "SEO", groups: ["SEO"] },
  { id: "media", label: "Media", groups: [] },
];

export async function patchGroup(group: SettingGroup, updates: { key: string; value: string }[]) {
  const res = await fetch(`/api/admin/settings/${group}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? "Save failed");
  }
  return res.json() as Promise<{ paymentKeysChanged?: boolean }>;
}

export function FieldInput({
  row,
  onChange,
}: {
  row: Row;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const isPassword = row.type === "PASSWORD";
  const isBool = row.type === "BOOLEAN";
  const isNum = row.type === "NUMBER";
  const isArea = row.type === "TEXTAREA" || row.type === "JSON";
  const isImage = row.type === "IMAGE";

  if (isBool) {
    return (
      <label className="flex cursor-pointer items-center gap-2 font-body text-sm text-charcoal">
        <input
          type="checkbox"
          checked={row.value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
          className="accent-olive"
        />
        Enable
      </label>
    );
  }

  if (isPassword) {
    return (
      <div className="flex gap-2">
        <input
          type={show ? "text" : "password"}
          className="min-w-0 flex-1 border border-[#EBEBEA] px-3 py-2 font-body text-sm"
          value={row.value === PASSWORD_MASK ? "" : row.value}
          placeholder={row.value === PASSWORD_MASK ? "•••••••• (unchanged)" : ""}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="text-xs text-olive underline" onClick={() => setShow((s) => !s)}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
    );
  }

  if (isArea) {
    return (
      <textarea
        className="min-h-[88px] w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm"
        value={row.value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (row.key === "store_currency_default" || row.key === "sms_provider" || row.key === "email_provider" || row.key === "monnify_environment") {
    const opts =
      row.key === "store_currency_default"
        ? ["NGN", "USD", "GBP"]
        : row.key === "monnify_environment"
          ? ["sandbox", "production"]
          : row.key === "email_provider"
            ? ["resend", "brevo", "smtp"]
            : ["termii", "twilio", "africastalking"];
    return (
      <select
        className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm"
        value={row.value}
        onChange={(e) => onChange(e.target.value)}
      >
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  if (isNum) {
    return (
      <input
        type="number"
        className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm"
        value={row.value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <input
      type="text"
      className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm"
      value={row.value}
      placeholder={isImage ? "Image URL (Cloudinary or CDN)" : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SettingsGroupCard({
  title,
  group,
  rows,
  onSaved,
}: {
  title: string;
  group: SettingGroup;
  rows: Row[];
  onSaved: () => void;
}) {
  const [local, setLocal] = useState<Row[]>(rows);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal(rows);
  }, [rows]);

  const updateVal = (key: string, value: string) => {
    setLocal((prev) => prev.map((r) => (r.key === key ? { ...r, value } : r)));
  };

  const save = async () => {
    setSaving(true);
    try {
      const updates = local.map((r) => ({ key: r.key, value: r.value }));
      const res = await patchGroup(group, updates);
      toast.success(`${title} saved ✓`);
      if (res.paymentKeysChanged) toast("Payment keys updated — restart if you rely on env vars.", { icon: "ℹ️" });
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-sm border border-[#EBEBEA] bg-canvas p-6">
      <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-[#6B6B68]">{title}</h2>
      <div className="mt-6 space-y-5">
        {local.map((row) => (
          <div key={row.key}>
            <label className="font-body text-xs text-charcoal">{row.label}</label>
            <div className="mt-1.5">
              <FieldInput row={row} onChange={(v) => updateVal(row.key, v)} />
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
        {saving ? "Saving…" : `Save ${title}`}
      </button>
    </div>
  );
}

export function AdminSettingsClient() {
  const [tab, setTab] = useState("store");
  const [settings, setSettings] = useState<Partial<Record<SettingGroup, Row[]>> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    if (!res.ok) return;
    const j = (await res.json()) as { settings: Partial<Record<SettingGroup, Row[]>> };
    setSettings(j.settings);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rowsFor = useCallback(
    (g: SettingGroup) => settings?.[g] ?? [],
    [settings],
  );

  const paymentsTest = async (gateway: "paystack" | "flutterwave" | "stripe" | "monnify") => {
    const res = await fetch("/api/admin/settings/test-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gateway }),
    });
    const j = await res.json().catch(() => ({}));
    if ((j as { ok?: boolean }).ok) toast.success((j as { message?: string }).message ?? "OK");
    else toast.error((j as { message?: string }).message ?? "Failed");
  };

  const tabContent = useMemo(() => {
    if (!settings) return <p className="p-6 text-sm text-[#6B6B68]">Loading…</p>;

    if (tab === "media") return <MediaLibraryTab />;

    if (tab === "appearance") {
      return <AppearanceSettingsCard rows={rowsFor("APPEARANCE")} onSaved={load} />;
    }

    if (tab === "email") {
      const emailConfig = rowsFor("EMAIL").filter((r) => !r.key.startsWith("email_tpl_"));
      return (
        <div className="space-y-6">
          <SettingsGroupCard title="Email" group="EMAIL" rows={emailConfig} onSaved={load} />
          <SettingsGroupCard title="SMS" group="SMS" rows={rowsFor("SMS")} onSaved={load} />
          <EmailTemplatesEditor emailRows={rowsFor("EMAIL")} onSaved={load} />
          <div className="rounded-sm border border-[#EBEBEA] bg-canvas p-6">
            <button
              type="button"
              className="text-sm text-olive underline"
              onClick={async () => {
                const res = await fetch("/api/admin/emails/test", { method: "POST" });
                const j = await res.json().catch(() => ({}));
                if (res.ok) toast.success((j as { message?: string }).message ?? "Sent");
                else toast.error((j as { error?: string }).error ?? "Failed");
              }}
            >
              Send test email
            </button>
          </div>
        </div>
      );
    }

    if (tab === "payments") {
      return (
        <div className="space-y-4">
          <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 font-body text-xs text-amber-950">
            Payment keys are encrypted in the database and never sent in full to the browser. Changes apply to API routes that
            read from settings.
          </div>
          <Accordion.Root type="multiple" className="space-y-2">
            {(["paystack", "flutterwave", "stripe", "monnify"] as const).map((gw) => (
              <Accordion.Item key={gw} value={gw} className="rounded-sm border border-[#EBEBEA] bg-canvas">
                <Accordion.Header>
                  <Accordion.Trigger className="flex w-full items-center justify-between px-4 py-3 font-body text-sm font-medium capitalize">
                    {gw}
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="border-t border-[#EBEBEA] px-4 pb-4 pt-2">
                  <button
                    type="button"
                    className="mb-3 text-xs text-olive underline"
                    onClick={() => void paymentsTest(gw)}
                  >
                    Test connection
                  </button>
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
          <SettingsGroupCard title="Payment keys" group="PAYMENTS" rows={rowsFor("PAYMENTS")} onSaved={load} />
        </div>
      );
    }

    const def = TABS.find((t) => t.id === tab);
    if (!def || !def.groups.length) return null;

    return (
      <div className="space-y-6">
        {def.groups.map((g) => (
          <SettingsGroupCard key={g} title={g} group={g} rows={rowsFor(g)} onSaved={load} />
        ))}
      </div>
    );
  }, [tab, settings, rowsFor, load]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <Tabs.Root value={tab} onValueChange={setTab} className="flex w-full flex-col gap-6 lg:flex-row">
        <Tabs.List className="flex shrink-0 flex-row flex-wrap gap-1 border-b border-[#EBEBEA] pb-2 lg:w-48 lg:flex-col lg:border-b-0 lg:border-r lg:pr-4 lg:pb-0">
          {TABS.map((t) => (
            <Tabs.Trigger
              key={t.id}
              value={t.id}
              className="px-3 py-2 text-left font-body text-[11px] font-medium uppercase tracking-[0.1em] text-[#6B6B68] data-[state=active]:bg-[#F5F5F3] data-[state=active]:text-ink lg:w-full"
            >
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <div className="min-w-0 flex-1">{tabContent}</div>
      </Tabs.Root>
    </div>
  );
}
