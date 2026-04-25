"use client";

import { useRouter } from "next/navigation";
import type { ShippingZone } from "@prisma/client";

export function ShippingAdminClient({ zones }: { zones: ShippingZone[] }) {
  const router = useRouter();

  async function toggle(id: string, isActive: boolean) {
    await fetch(`/api/admin/shipping/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    router.refresh();
  }

  return (
    <div className="mt-8 overflow-x-auto rounded-sm border border-[#EBEBEA] bg-canvas">
      <table className="w-full text-left text-sm text-charcoal">
        <thead className="text-[#A8A8A4]">
          <tr>
            <th className="p-3">Name</th>
            <th className="p-3">Countries</th>
            <th className="p-3">Flat ₦</th>
            <th className="p-3">Free above</th>
            <th className="p-3">Days</th>
            <th className="p-3">Active</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z) => (
            <tr key={z.id} className="border-t border-[#EBEBEA]">
              <td className="p-3">{z.name}</td>
              <td className="p-3 text-xs">{z.countries.join(", ")}</td>
              <td className="p-3">{z.flatRateNGN}</td>
              <td className="p-3">{z.freeAboveNGN ?? "—"}</td>
              <td className="p-3 text-xs">{z.estimatedDays}</td>
              <td className="p-3">
                <input
                  type="checkbox"
                  checked={z.isActive}
                  onChange={() => void toggle(z.id, z.isActive)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
