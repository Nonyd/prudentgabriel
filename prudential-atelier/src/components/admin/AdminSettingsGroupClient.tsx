"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import toast from "react-hot-toast";
import type { SettingGroup, SettingType } from "@prisma/client";
import { AppearanceSettingsForm } from "@/components/admin/settings/AppearanceSettingsForm";
import { ContentSettingsForm } from "@/components/admin/settings/ContentSettingsForm";
import { EmailTemplatesEditor } from "@/components/admin/settings/EmailTemplatesEditor";
import { SocialSettingsForm } from "@/components/admin/settings/SocialSettingsForm";
import { SettingsGroupCard } from "@/components/admin/AdminSettingsClient";

type Row = {
  key: string;
  value: string;
  label: string;
  type: SettingType;
  isPublic: boolean;
  sortOrder: number;
};

export type AdminSettingsGroupSlug =
  | "store"
  | "payments"
  | "email"
  | "appearance"
  | "content"
  | "social"
  | "loyalty"
  | "notifications"
  | "seo";

export function AdminSettingsGroupClient({ groupSlug }: { groupSlug: AdminSettingsGroupSlug }) {
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

  const rowsFor = useCallback((g: SettingGroup) => settings?.[g] ?? [], [settings]);

  const paymentsTest = useCallback(async (gateway: "paystack" | "flutterwave" | "stripe" | "monnify") => {
    const res = await fetch("/api/admin/settings/test-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gateway }),
    });
    const j = await res.json().catch(() => ({}));
    if ((j as { ok?: boolean }).ok) toast.success((j as { message?: string }).message ?? "OK");
    else toast.error((j as { message?: string }).message ?? "Failed");
  }, []);

  const body = useMemo(() => {
    if (!settings) return <p className="p-6 font-body text-sm text-[#6B6B68]">Loading…</p>;

    if (groupSlug === "store") {
      return <SettingsGroupCard title="Store" group="STORE" rows={rowsFor("STORE")} onSaved={load} />;
    }

    if (groupSlug === "social") {
      return <SocialSettingsForm rows={rowsFor("SOCIAL")} onSaved={load} />;
    }

    if (groupSlug === "loyalty") {
      return <SettingsGroupCard title="Loyalty" group="LOYALTY" rows={rowsFor("LOYALTY")} onSaved={load} />;
    }

    if (groupSlug === "notifications") {
      return (
        <SettingsGroupCard title="Notifications" group="NOTIFICATIONS" rows={rowsFor("NOTIFICATIONS")} onSaved={load} />
      );
    }

    if (groupSlug === "seo") {
      return <SettingsGroupCard title="SEO" group="SEO" rows={rowsFor("SEO")} onSaved={load} />;
    }

    if (groupSlug === "appearance") {
      return <AppearanceSettingsForm rows={rowsFor("APPEARANCE")} onSaved={load} />;
    }

    if (groupSlug === "content") {
      return <ContentSettingsForm />;
    }

    if (groupSlug === "email") {
      const emailConfig = rowsFor("EMAIL").filter((r) => !r.key.startsWith("email_tpl_"));
      return (
        <div className="space-y-6">
          <SettingsGroupCard title="Email" group="EMAIL" rows={emailConfig} onSaved={load} />
          <SettingsGroupCard title="SMS" group="SMS" rows={rowsFor("SMS")} onSaved={load} />
          <EmailTemplatesEditor emailRows={rowsFor("EMAIL")} onSaved={load} />
          <div className="border border-[#EBEBEA] bg-canvas p-6">
            <button
              type="button"
              className="font-body text-sm text-olive underline"
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

    if (groupSlug === "payments") {
      return (
        <div className="space-y-4">
          <div className="border border-amber-200 bg-amber-50 px-4 py-3 font-body text-xs text-amber-950">
            Payment keys are encrypted in the database. Changes apply to API routes that read from settings.
          </div>
          <Accordion.Root type="multiple" className="space-y-2">
            {(["paystack", "flutterwave", "stripe", "monnify"] as const).map((gw) => (
              <Accordion.Item key={gw} value={gw} className="border border-[#EBEBEA] bg-canvas">
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

    return null;
  }, [groupSlug, settings, rowsFor, load, paymentsTest]);

  return <div className="min-w-0">{body}</div>;
}
