"use client";

import { useRouter } from "next/navigation";
import type { BespokeRequest, BespokeStatus } from "@prisma/client";
import { useState } from "react";
import toast from "react-hot-toast";

export function BespokeAdminTable({ initial }: { initial: BespokeRequest[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"ALL" | BespokeStatus>("ALL");

  const filtered =
    tab === "ALL" ? initial : initial.filter((r) => r.status === tab);

  async function updateStatus(id: string, status: BespokeStatus) {
    const res = await fetch(`/api/admin/bespoke/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast.error("Update failed");
      return;
    }
    toast.success("Updated");
    router.refresh();
  }

  const tabs: ("ALL" | BespokeStatus)[] = [
    "ALL",
    "PENDING",
    "REVIEWED",
    "CONFIRMED",
    "IN_PROGRESS",
    "READY",
    "DELIVERED",
    "CANCELLED",
  ];

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-2 border-b border-gold/10 pb-3">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-sm px-3 py-1 text-xs uppercase ${
              tab === t ? "bg-wine text-gold" : "text-[#8A8A8A] hover:text-ivory"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="-mx-4 overflow-x-auto rounded-sm border border-gold/10 bg-[#1E1E1E] px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[700px] text-left text-sm text-ivory/90">
          <thead className="text-[11px] uppercase text-[#8A8A8A]">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Client</th>
              <th className="p-3">Occasion</th>
              <th className="hidden p-3 md:table-cell">Budget</th>
              <th className="hidden p-3 md:table-cell">Timeline</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
              <th className="p-3">Update</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-gold/10">
                <td className="p-3 font-label text-gold">{r.requestNumber}</td>
                <td className="p-3">
                  <div>{r.name}</div>
                  <div className="text-xs text-[#8A8A8A]">{r.email}</div>
                </td>
                <td className="p-3 max-w-[200px] truncate">{r.occasion}</td>
                <td className="hidden max-w-[120px] truncate p-3 text-xs md:table-cell">{r.budgetRange ?? r.budget ?? "—"}</td>
                <td className="hidden max-w-[100px] truncate p-3 text-xs md:table-cell">{r.timeline ?? "—"}</td>
                <td className="p-3 text-xs">{r.status}</td>
                <td className="p-3 text-xs text-[#8A8A8A]">{r.createdAt.toLocaleDateString("en-NG")}</td>
                <td className="p-3">
                  <select
                    className="rounded-sm border border-gold/15 bg-[#0F0F0F] px-2 py-1 text-xs text-ivory"
                    value={r.status}
                    onChange={(e) => void updateStatus(r.id, e.target.value as BespokeStatus)}
                  >
                    {tabs
                      .filter((x) => x !== "ALL")
                      .map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
