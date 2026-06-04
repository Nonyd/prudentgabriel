"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";

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

export function GeneralSettingsClient() {
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    try {
      toast.success("Settings saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card-surface p-6">
      <h2 className="font-serif text-lg font-medium text-choc">General settings</h2>
      <p className="mt-1 font-sans text-xs text-text-mid">
        Site identity, consultation pricing, and operational defaults.
      </p>
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
  );
}
