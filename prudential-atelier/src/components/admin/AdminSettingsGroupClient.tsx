"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SettingGroup, SettingType } from "@prisma/client";
import { AppearanceSettingsForm } from "@/components/admin/settings/AppearanceSettingsForm";
import { ContentSettingsForm } from "@/components/admin/settings/ContentSettingsForm";
import { SocialSettingsForm } from "@/components/admin/settings/SocialSettingsForm";
import { LoyaltySettingsClient } from "@/components/admin/settings/LoyaltySettingsClient";
import { SettingsGroupCard } from "@/components/admin/AdminSettingsClient";
import { PaymentsSettingsClient } from "@/components/admin/PaymentsSettingsClient";

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
    if (groupSlug === "payments") return;
    void load();
  }, [load, groupSlug]);

  const rowsFor = useCallback((g: SettingGroup) => settings?.[g] ?? [], [settings]);

  const body = useMemo(() => {
    if (groupSlug === "payments") {
      return <PaymentsSettingsClient />;
    }

    if (!settings) return <p className="p-6 font-body text-sm text-[#6B6B68]">Loading…</p>;

    if (groupSlug === "store") {
      return <SettingsGroupCard title="Store" group="STORE" rows={rowsFor("STORE")} onSaved={load} />;
    }

    if (groupSlug === "social") {
      return <SocialSettingsForm rows={rowsFor("SOCIAL")} onSaved={load} />;
    }

    if (groupSlug === "loyalty") {
      return <LoyaltySettingsClient />;
    }

    if (groupSlug === "notifications") {
      return (
        <div className="space-y-4">
          <p className="font-body text-sm text-[#6B6B68]">
            Slack webhook is a credential — set it in{" "}
            <a href="/admin/settings/developer" className="underline">
              Developer settings
            </a>
            .
          </p>
          <SettingsGroupCard title="Notifications" group="NOTIFICATIONS" rows={rowsFor("NOTIFICATIONS")} onSaved={load} />
        </div>
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
      return (
        <div className="space-y-6">
          <p className="font-body text-sm text-[#6B6B68]">
            API keys, SMTP password, and provider order are on{" "}
            <a href="/admin/settings/developer" className="underline">
              Developer settings
            </a>
            . Transactional copy is edited under{" "}
            <a href="/admin/content/email-templates" className="underline">
              Content → Email templates
            </a>
            .
          </p>
          <SettingsGroupCard title="From address" group="EMAIL" rows={rowsFor("EMAIL")} onSaved={load} />
          <SettingsGroupCard title="SMS" group="SMS" rows={rowsFor("SMS")} onSaved={load} />
        </div>
      );
    }

    return null;
  }, [groupSlug, settings, rowsFor, load]);

  return <div className="min-w-0">{body}</div>;
}
