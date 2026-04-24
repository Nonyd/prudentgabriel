"use client";

import { useRouter } from "next/navigation";
import type { Coupon } from "@prisma/client";
import { useState } from "react";
import toast from "react-hot-toast";

export function CouponsAdminClient({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");

  async function toggle(id: string, isActive: boolean) {
    const res = await fetch(`/api/admin/coupons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    if (!res.ok) toast.error("Failed");
    else {
      toast.success("Saved");
      router.refresh();
    }
  }

  async function createQuick() {
    if (!code.trim()) return;
    const res = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.toUpperCase(),
        type: "PERCENTAGE",
        value: 10,
        appliesToAll: true,
        isActive: true,
      }),
    });
    if (!res.ok) toast.error("Could not create");
    else {
      toast.success("Coupon created");
      setCode("");
      router.refresh();
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap gap-2 rounded-sm border border-gold/10 bg-[#1E1E1E] p-4">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="New code (e.g. SAVE10)"
          className="min-w-[160px] flex-1 rounded-sm border border-gold/15 bg-[#0F0F0F] px-3 py-2 text-sm text-ivory"
        />
        <button
          type="button"
          onClick={() => void createQuick()}
          className="rounded-sm bg-wine px-4 py-2 text-xs text-gold"
        >
          Quick create 10%
        </button>
      </div>
      <div className="overflow-x-auto rounded-sm border border-gold/10 bg-[#1E1E1E]">
        <table className="w-full text-left text-sm">
          <thead className="text-[#8A8A8A]">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Type</th>
              <th className="p-3">Value</th>
              <th className="p-3">Uses</th>
              <th className="p-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-t border-gold/10">
                <td className="p-3 font-mono text-gold">{c.code}</td>
                <td className="p-3 text-xs">{c.type}</td>
                <td className="p-3">{c.value}</td>
                <td className="p-3 text-xs">
                  {c.usedCount} / {c.maxUsesTotal ?? "∞"}
                </td>
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={c.isActive}
                    onChange={() => void toggle(c.id, c.isActive)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
