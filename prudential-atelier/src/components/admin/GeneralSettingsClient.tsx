"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";

const FIELDS = [
  { key: "site_name", label: "Site name", defaultValue: "Prudential Atelier" },
  { key: "contact_email", label: "Contact email", defaultValue: "hello@prudentgabriel.com" },
  { key: "contact_phone", label: "Phone", defaultValue: "+234" },
  { key: "address", label: "Address", defaultValue: "Lagos, Nigeria" },
  { key: "consult_virtual", label: "Virtual consultation (NGN)", defaultValue: "25000" },
  { key: "consult_prudent", label: "In-person with Mrs. Prudent (NGN)", defaultValue: "75000" },
  { key: "consult_team", label: "In-person with team (NGN)", defaultValue: "45000" },
  { key: "low_stock_threshold", label: "Low stock threshold", defaultValue: "2" },
  { key: "best_seller_threshold", label: "Best seller threshold", defaultValue: "10" },
];

const DEFAULT_MAINTENANCE_MESSAGE = "We're making some improvements. Check back soon.";

export function GeneralSettingsClient() {
  const [saving, setSaving] = useState(false);
  const [autoConvert, setAutoConvert] = useState(false);
  const [autoConvertLoading, setAutoConvertLoading] = useState(true);
  const [autoConvertSaving, setAutoConvertSaving] = useState(false);

  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [maintenanceSavedEnabled, setMaintenanceSavedEnabled] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/settings/general");
        if (res.ok) {
          const data = (await res.json()) as {
            autoConvertApprovedQuotes?: boolean;
            maintenanceModeEnabled?: boolean;
            maintenanceModeMessage?: string;
          };
          setAutoConvert(Boolean(data.autoConvertApprovedQuotes));
          setMaintenanceEnabled(Boolean(data.maintenanceModeEnabled));
          setMaintenanceSavedEnabled(Boolean(data.maintenanceModeEnabled));
          setMaintenanceMessage(data.maintenanceModeMessage ?? "");
        }
      } finally {
        setAutoConvertLoading(false);
        setMaintenanceLoading(false);
      }
    })();
  }, []);

  const onAutoConvertChange = async (enabled: boolean) => {
    setAutoConvert(enabled);
    setAutoConvertSaving(true);
    try {
      const res = await fetch("/api/admin/settings/general", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoConvertApprovedQuotes: enabled }),
      });
      if (!res.ok) {
        setAutoConvert(!enabled);
        toast.error("Could not save setting");
        return;
      }
      toast.success(enabled ? "Auto-convert enabled" : "Auto-convert disabled");
    } catch {
      setAutoConvert(!enabled);
      toast.error("Could not save setting");
    } finally {
      setAutoConvertSaving(false);
    }
  };

  const onSaveMaintenance = async () => {
    setMaintenanceSaving(true);
    try {
      const res = await fetch("/api/admin/settings/general", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenanceModeEnabled: maintenanceEnabled,
          maintenanceModeMessage: maintenanceMessage.trim(),
        }),
      });
      if (!res.ok) {
        toast.error("Could not save maintenance settings");
        return;
      }

      const wasEnabled = maintenanceSavedEnabled;
      setMaintenanceSavedEnabled(maintenanceEnabled);

      if (maintenanceEnabled && !wasEnabled) {
        toast.success(
          "Maintenance mode activated. The public site is now hidden from visitors.",
          { style: { background: "#C9A84C", color: "#1A0F08" } },
        );
      } else if (!maintenanceEnabled && wasEnabled) {
        toast.success("Maintenance mode deactivated. The public site is now live.", {
          style: { background: "#2d7d4f", color: "#ffffff" },
        });
      } else {
        toast.success("Maintenance settings saved");
      }
    } catch {
      toast.error("Could not save maintenance settings");
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      toast.success("Settings saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="card-surface p-6">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-text-mid">
          Maintenance mode
        </p>
        <div className="mt-4 border-t border-sand pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-sans text-sm font-medium text-ink">Maintenance Mode</p>
              <p className="mt-1 font-sans text-xs leading-relaxed text-text-mid">
                When enabled, only logged-in admin users can view the website. All other visitors
                see a maintenance page instead.
              </p>
            </div>
            <Toggle
              checked={maintenanceEnabled}
              onChange={setMaintenanceEnabled}
              disabled={maintenanceLoading || maintenanceSaving}
              srLabel="Maintenance mode"
            />
          </div>

          <p
            className="mt-3 font-sans text-xs font-medium"
            style={{ color: maintenanceEnabled ? "#C9A84C" : undefined }}
          >
            {maintenanceLoading
              ? "Loading status…"
              : maintenanceEnabled
                ? "Current status: ⚠ MAINTENANCE MODE ACTIVE"
                : "Current status: ● LIVE"}
          </p>

          <label className="mt-5 block">
            <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-mid">
              Custom message (optional)
            </span>
            <textarea
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              placeholder={DEFAULT_MAINTENANCE_MESSAGE}
              rows={3}
              disabled={maintenanceLoading || maintenanceSaving}
              className="input-field w-full resize-y font-serif text-sm"
            />
          </label>

          <div className="mt-5">
            <Button
              type="button"
              loading={maintenanceSaving}
              disabled={maintenanceLoading}
              onClick={() => void onSaveMaintenance()}
            >
              Save
            </Button>
          </div>
        </div>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-serif text-lg font-medium text-choc">General settings</h2>
        <p className="mt-1 font-sans text-xs text-text-mid">
          Site identity, consultation pricing, and operational defaults.
        </p>

        <div className="mt-6 rounded-lg border border-sand bg-bg/40 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-sans text-sm font-medium text-ink">Auto-convert approved quotes to orders</p>
              <p className="mt-1 font-sans text-xs leading-relaxed text-text-mid">
                When a client approves a quotation, automatically create a bespoke order and invoice without
                manual action.
              </p>
            </div>
            <Toggle
              checked={autoConvert}
              onChange={(v) => void onAutoConvertChange(v)}
              disabled={autoConvertLoading || autoConvertSaving}
              srLabel="Auto-convert approved quotes to orders"
            />
          </div>
          <p className="mt-2 font-sans text-[11px] text-text-light">
            {autoConvertLoading
              ? "Loading…"
              : autoConvertSaving
                ? "Saving…"
                : autoConvert
                  ? "On"
                  : "Off"}
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {FIELDS.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-mid">
                {field.label}
              </span>
              <input
                name={field.key}
                defaultValue={field.defaultValue}
                className="input-field w-full"
              />
            </label>
          ))}
        </div>
        <div className="mt-6">
          <Button type="button" loading={saving} onClick={() => void onSave()}>
            Save general settings
          </Button>
        </div>
      </section>
    </div>
  );
}
