"use client";

import { useState } from "react";
import type { LagosLocation, PickupLocation, ShippingMethod } from "@prisma/client";

type MethodWithLocs = ShippingMethod & {
  pickupLocations: PickupLocation[];
  lagosLocations: LagosLocation[];
};

export function ShippingAdminClient({ initialMethods }: { initialMethods: MethodWithLocs[] }) {
  const [methods, setMethods] = useState(initialMethods);
  const local = methods.find((m) => m.kind === "LOCAL_FLAT");
  const pickup = methods.find((m) => m.kind === "PICKUP");
  const gig = methods.find((m) => m.kind === "CARRIER_GIG");
  const dhl = methods.find((m) => m.kind === "CARRIER_DHL");

  const [lagosForm, setLagosForm] = useState({ name: "", price: "3500", freeAbove: "", eta: "2–4 business days" });
  const [pickupForm, setPickupForm] = useState({
    name: "",
    address: "",
    hours: "Monday–Friday 9:00–18:00",
    instructions: "",
  });

  async function reload() {
    const res = await fetch("/api/admin/shipping");
    if (!res.ok) return;
    const data = (await res.json()) as { methods: MethodWithLocs[] };
    setMethods(data.methods);
  }

  async function addLagos() {
    const price = Number(lagosForm.price);
    if (!lagosForm.name.trim() || !Number.isFinite(price)) return;
    await fetch("/api/admin/shipping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: lagosForm.name.trim(),
        price,
        freeAboveNGN: lagosForm.freeAbove ? Number(lagosForm.freeAbove) : null,
        etaText: lagosForm.eta.trim() || "2–4 business days",
        isActive: true,
      }),
    });
    setLagosForm({ name: "", price: "3500", freeAbove: "", eta: "2–4 business days" });
    await reload();
  }

  async function patchLagos(id: string, body: Record<string, unknown>) {
    await fetch(`/api/admin/shipping/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await reload();
  }

  async function addPickup() {
    if (!pickupForm.name.trim() || !pickupForm.address.trim()) return;
    await fetch("/api/admin/shipping/pickup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pickupForm),
    });
    setPickupForm({ name: "", address: "", hours: "Monday–Friday 9:00–18:00", instructions: "" });
    await reload();
  }

  return (
    <div className="mt-6 space-y-10">
      <div>
        <h1 className="font-display text-[24px] text-ink">Shipping</h1>
        <p className="mt-1 max-w-2xl font-body text-[13px] text-[#6B6B68]">
          Lagos locations appear at checkout as soon as you save them. Add Yaba, Ajah, or anywhere you deliver — set the
          price here, no deploy.
        </p>
      </div>

      <section className="border border-sand bg-bg-card p-6">
        <h2 className="font-display text-xl text-ink">Lagos delivery</h2>
        <p className="mt-1 font-body text-xs text-[#6B6B68]">
          Each row is a neighbourhood or area the customer picks at checkout. Inactive rows stay on file but do not
          appear.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="font-sans text-[10px] uppercase tracking-wide text-[#A8A8A4]">
              <tr>
                <th className="pb-2">Area</th>
                <th className="pb-2">Price (₦)</th>
                <th className="pb-2">Free above (₦)</th>
                <th className="pb-2">ETA</th>
                <th className="pb-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {(local?.lagosLocations ?? []).map((loc) => (
                <tr key={loc.id} className="border-t border-[#F5F5F3]">
                  <td className="py-3">
                    <input
                      defaultValue={loc.name}
                      className="w-full border border-sand bg-canvas px-2 py-1"
                      onBlur={(e) => {
                        const name = e.target.value.trim();
                        if (name && name !== loc.name) void patchLagos(loc.id, { name });
                      }}
                    />
                  </td>
                  <td className="py-3">
                    <input
                      type="number"
                      defaultValue={loc.price}
                      className="w-28 border border-sand bg-canvas px-2 py-1"
                      onBlur={(e) => {
                        const price = Number(e.target.value);
                        if (Number.isFinite(price) && price !== loc.price) void patchLagos(loc.id, { price });
                      }}
                    />
                  </td>
                  <td className="py-3">
                    <input
                      type="number"
                      defaultValue={loc.freeAboveNGN ?? ""}
                      placeholder="—"
                      className="w-32 border border-sand bg-canvas px-2 py-1"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        const freeAboveNGN = v ? Number(v) : null;
                        void patchLagos(loc.id, { freeAboveNGN });
                      }}
                    />
                  </td>
                  <td className="py-3">
                    <input
                      defaultValue={loc.etaText}
                      className="w-40 border border-sand bg-canvas px-2 py-1"
                      onBlur={(e) => {
                        const etaText = e.target.value.trim();
                        if (etaText && etaText !== loc.etaText) void patchLagos(loc.id, { etaText });
                      }}
                    />
                  </td>
                  <td className="py-3">
                    <input
                      type="checkbox"
                      checked={loc.isActive}
                      onChange={() => void patchLagos(loc.id, { isActive: !loc.isActive })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <input
            placeholder="Area name — e.g. Yaba"
            className="border border-sand bg-canvas px-3 py-2 text-sm"
            value={lagosForm.name}
            onChange={(e) => setLagosForm((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            type="number"
            placeholder="Price ₦"
            className="border border-sand bg-canvas px-3 py-2 text-sm"
            value={lagosForm.price}
            onChange={(e) => setLagosForm((p) => ({ ...p, price: e.target.value }))}
          />
          <input
            placeholder="Free above ₦ (optional)"
            className="border border-sand bg-canvas px-3 py-2 text-sm"
            value={lagosForm.freeAbove}
            onChange={(e) => setLagosForm((p) => ({ ...p, freeAbove: e.target.value }))}
          />
          <button
            type="button"
            onClick={() => void addLagos()}
            className="bg-[#37392d] px-4 py-2 font-body text-xs uppercase tracking-[0.08em] text-white"
          >
            Add location
          </button>
        </div>
      </section>

      <section className="border border-sand bg-bg-card p-6">
        <h2 className="font-display text-xl text-ink">Store pickup</h2>
        <p className="mt-1 font-body text-xs text-[#6B6B68]">Address, hours, and handover instructions shown to the customer.</p>
        {(pickup?.pickupLocations ?? []).map((loc) => (
          <div key={loc.id} className="mt-4 border-t border-[#F5F5F3] pt-4">
            <p className="font-body text-sm text-ink">{loc.name}</p>
            <p className="font-body text-xs text-[#6B6B68]">{loc.address}</p>
            <p className="font-body text-xs text-[#6B6B68]">{loc.hours}</p>
          </div>
        ))}
        <div className="mt-4 grid gap-2">
          <input
            placeholder="Location name"
            className="border border-sand bg-canvas px-3 py-2 text-sm"
            value={pickupForm.name}
            onChange={(e) => setPickupForm((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            placeholder="Address"
            className="border border-sand bg-canvas px-3 py-2 text-sm"
            value={pickupForm.address}
            onChange={(e) => setPickupForm((p) => ({ ...p, address: e.target.value }))}
          />
          <input
            placeholder="Hours"
            className="border border-sand bg-canvas px-3 py-2 text-sm"
            value={pickupForm.hours}
            onChange={(e) => setPickupForm((p) => ({ ...p, hours: e.target.value }))}
          />
          <button
            type="button"
            onClick={() => void addPickup()}
            className="w-fit bg-[#37392d] px-4 py-2 font-body text-xs uppercase tracking-[0.08em] text-white"
          >
            Add pickup location
          </button>
        </div>
      </section>

      <section className="border border-sand bg-bg-card p-6">
        <h2 className="font-display text-xl text-ink">Carriers</h2>
        <p className="mt-1 font-body text-xs text-[#6B6B68]">
          GIG and DHL are live-rated. Until the accounts are open, checkout takes the personal-quote path. Markup is a
          buffer — DHL adds fuel and remote-area charges after quoting.
        </p>
        {[gig, dhl].filter(Boolean).map((m) => (
          <div key={m!.id} className="mt-4 flex flex-wrap items-end gap-3 border-t border-[#F5F5F3] pt-4">
            <p className="w-40 font-body text-sm text-ink">{m!.name}</p>
            <label className="text-xs text-[#6B6B68]">
              Markup
              <select
                className="ml-2 border border-sand bg-canvas px-2 py-1"
                defaultValue={m!.markupKind ?? "PERCENT"}
                onChange={(e) => void patchLagos(m!.id, { markupKind: e.target.value })}
              >
                <option value="PERCENT">%</option>
                <option value="FLAT">Flat ₦</option>
              </select>
            </label>
            <input
              type="number"
              defaultValue={m!.markupValue ?? 0}
              className="w-24 border border-sand bg-canvas px-2 py-1 text-sm"
              onBlur={(e) => void patchLagos(m!.id, { markupValue: Number(e.target.value) })}
            />
            <label className="inline-flex items-center gap-1 text-xs text-[#6B6B68]">
              <input
                type="checkbox"
                checked={m!.isActive}
                onChange={() => void patchLagos(m!.id, { isActive: !m!.isActive })}
              />
              Active
            </label>
          </div>
        ))}
      </section>
    </div>
  );
}
