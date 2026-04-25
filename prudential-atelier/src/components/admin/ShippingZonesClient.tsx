"use client";

import { useState } from "react";
import type { ShippingZone } from "@prisma/client";
import { ShippingZoneModal } from "@/components/admin/ShippingZoneModal";

export function ShippingZonesClient({ initialZones }: { initialZones: ShippingZone[] }) {
  const [zones, setZones] = useState(initialZones);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ShippingZone | null>(null);

  async function reload() {
    const response = await fetch("/api/admin/shipping");
    if (!response.ok) return;
    const payload = (await response.json()) as { items: ShippingZone[] };
    setZones(payload.items);
  }

  async function toggle(zone: ShippingZone) {
    await fetch(`/api/admin/shipping/${zone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !zone.isActive }),
    });
    await reload();
  }

  async function remove(id: string) {
    const response = await fetch(`/api/admin/shipping/${id}`, { method: "DELETE" });
    if (response.status === 409) {
      window.alert("Cannot delete — active orders use this zone");
      return;
    }
    await reload();
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] text-ink">Shipping Zones</h1>
          <p className="font-body text-[13px] text-[#6B6B68]">{zones.length} zones configured</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="bg-[#37392d] px-4 py-2 font-body text-xs uppercase tracking-[0.08em] text-white"
        >
          + Add Zone
        </button>
      </div>

      <div className="border border-[#EBEBEA] bg-white">
        {zones.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-body text-sm text-[#6B6B68]">No shipping zones configured yet. Add your first zone.</p>
          </div>
        ) : (
          zones.map((zone) => (
            <div key={zone.id} className="flex flex-wrap items-start justify-between gap-4 border-b border-[#F5F5F3] px-6 py-5 last:border-b-0">
              <div>
                <p className="font-body text-sm font-medium text-ink">{zone.name}</p>
                <p className="font-body text-xs text-[#6B6B68]">{zone.countries.join(", ")}</p>
                {zone.countries.includes("NG") ? (
                  <p className="font-body text-[11px] text-[#6B6B68]">{zone.states.length ? zone.states.join(", ") : "All states"}</p>
                ) : null}
              </div>
              <div>
                <p className="font-body text-sm text-ink">₦{Math.round(zone.flatRateNGN).toLocaleString("en-NG")}</p>
                {zone.perKgNGN > 0 ? <p className="font-body text-xs text-[#6B6B68]">+ ₦{Math.round(zone.perKgNGN).toLocaleString("en-NG")}/kg</p> : null}
                {zone.freeAboveNGN ? <p className="font-body text-xs text-[#37392d]">Free above ₦{Math.round(zone.freeAboveNGN).toLocaleString("en-NG")}</p> : null}
              </div>
              <div className="text-right">
                <p className="font-body text-xs text-[#6B6B68]">{zone.estimatedDays}</p>
                <label className="mt-1 inline-flex items-center gap-1 font-body text-xs text-[#6B6B68]">
                  <input type="checkbox" checked={zone.isActive} onChange={() => void toggle(zone)} />
                  Active
                </label>
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => { setEditing(zone); setOpen(true); }} className="font-body text-[11px] text-[#37392d] hover:underline">Edit</button>
                  <button type="button" onClick={() => void remove(zone.id)} className="font-body text-[11px] text-red-600 hover:underline">Delete</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <ShippingZoneModal
        open={open}
        onOpenChange={setOpen}
        zone={editing}
        onSaved={() => {
          void reload();
        }}
      />
    </div>
  );
}
