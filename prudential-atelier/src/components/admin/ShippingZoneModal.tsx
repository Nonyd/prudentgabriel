"use client";

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { ShippingZone } from "@prisma/client";

const COUNTRY_OPTIONS = [
  { code: "NG", label: "Nigeria (NG)" },
  { code: "GB", label: "United Kingdom (GB)" },
  { code: "US", label: "United States (US)" },
  { code: "AU", label: "Australia (AU)" },
  { code: "CA", label: "Canada (CA)" },
  { code: "DE", label: "Germany (DE)" },
  { code: "FR", label: "France (FR)" },
  { code: "AE", label: "UAE (AE)" },
  { code: "ZA", label: "South Africa (ZA)" },
  { code: "GH", label: "Ghana (GH)" },
];

const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara",
];

type FormState = {
  name: string;
  countries: string[];
  states: string[];
  allStatesInNigeria: boolean;
  flatRateNGN: number;
  perKgNGN: number;
  freeAboveNGN: string;
  estimatedDays: string;
  isActive: boolean;
};

function toInitial(zone?: ShippingZone | null): FormState {
  return {
    name: zone?.name ?? "",
    countries: zone?.countries ?? [],
    states: zone?.states ?? [],
    allStatesInNigeria: (zone?.states?.length ?? 0) === 0,
    flatRateNGN: zone?.flatRateNGN ?? 0,
    perKgNGN: zone?.perKgNGN ?? 0,
    freeAboveNGN: zone?.freeAboveNGN != null ? String(zone.freeAboveNGN) : "",
    estimatedDays: zone?.estimatedDays ?? "",
    isActive: zone?.isActive ?? true,
  };
}

export function ShippingZoneModal({
  open,
  onOpenChange,
  zone,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  zone?: ShippingZone | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(toInitial(zone));
  const nigeriaSelected = useMemo(() => form.countries.includes("NG"), [form.countries]);

  async function submit() {
    const payload = {
      name: form.name,
      countries: form.countries,
      states: nigeriaSelected && !form.allStatesInNigeria ? form.states : [],
      flatRateNGN: Number(form.flatRateNGN),
      perKgNGN: Number(form.perKgNGN || 0),
      freeAboveNGN: form.freeAboveNGN ? Number(form.freeAboveNGN) : null,
      estimatedDays: form.estimatedDays,
      isActive: form.isActive,
    };

    const method = zone ? "PATCH" : "POST";
    const url = zone ? `/api/admin/shipping/${zone.id}` : "/api/admin/shipping";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return;
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[560px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 border border-[#EBEBEA] bg-white p-0">
          <div className="border-b border-[#EBEBEA] px-5 py-4">
            <Dialog.Title className="font-display text-xl text-ink">{zone ? "Edit Shipping Zone" : "Add Shipping Zone"}</Dialog.Title>
          </div>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Zone Name" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />

            <div>
              <p className="mb-2 font-body text-xs text-[#6B6B68]">Countries</p>
              <div className="grid grid-cols-2 gap-2">
                {COUNTRY_OPTIONS.map((country) => (
                  <label key={country.code} className="flex items-center gap-2 border border-[#EBEBEA] px-2 py-1.5 font-body text-xs">
                    <input
                      type="checkbox"
                      checked={form.countries.includes(country.code)}
                      onChange={(e) => {
                        setForm((prev) => ({
                          ...prev,
                          countries: e.target.checked
                            ? [...prev.countries, country.code]
                            : prev.countries.filter((code) => code !== country.code),
                        }));
                      }}
                    />
                    {country.label}
                  </label>
                ))}
              </div>
            </div>

            {nigeriaSelected ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 font-body text-xs">
                  <input type="checkbox" checked={form.allStatesInNigeria} onChange={(e) => setForm((prev) => ({ ...prev, allStatesInNigeria: e.target.checked }))} />
                  All Nigerian States
                </label>
                {!form.allStatesInNigeria ? (
                  <div className="grid grid-cols-3 gap-1 border border-[#EBEBEA] p-2">
                    {NIGERIAN_STATES.map((state) => (
                      <label key={state} className="flex items-center gap-1 font-body text-[11px]">
                        <input
                          type="checkbox"
                          checked={form.states.includes(state)}
                          onChange={(e) => {
                            setForm((prev) => ({
                              ...prev,
                              states: e.target.checked ? [...prev.states, state] : prev.states.filter((item) => item !== state),
                            }));
                          }}
                        />
                        {state}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={form.flatRateNGN} onChange={(e) => setForm((prev) => ({ ...prev, flatRateNGN: Number(e.target.value) }))} placeholder="Flat Rate (NGN)" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
              <input type="number" value={form.perKgNGN} onChange={(e) => setForm((prev) => ({ ...prev, perKgNGN: Number(e.target.value) }))} placeholder="Per KG (NGN)" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
              <input type="number" value={form.freeAboveNGN} onChange={(e) => setForm((prev) => ({ ...prev, freeAboveNGN: e.target.value }))} placeholder="Free Above (NGN)" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
              <input value={form.estimatedDays} onChange={(e) => setForm((prev) => ({ ...prev, estimatedDays: e.target.value }))} placeholder="Estimated Days (e.g. 1–2 business days)" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
            </div>

            <label className="flex items-center gap-2 font-body text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
              Active
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#EBEBEA] px-5 py-3">
            <button type="button" onClick={() => onOpenChange(false)} className="border border-[#EBEBEA] px-4 py-2 font-body text-xs">
              Cancel
            </button>
            <button type="button" onClick={() => void submit()} className="bg-[#37392d] px-4 py-2 font-body text-xs text-white">
              Save Zone
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
