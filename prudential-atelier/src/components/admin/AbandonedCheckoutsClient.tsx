"use client";

import { useState } from "react";
import toast from "react-hot-toast";

type Row = {
  id: string;
  email: string;
  itemsLabel: string;
  valueLabel: string;
  furthestStep: number;
  lastActiveAt: string;
  remindersSent: number;
  recovered: boolean;
  whatsappUrl: string | null;
  recentWarning: boolean;
};

export function AbandonedCheckoutsClient({ rows }: { rows: Row[] }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function remind(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/checkouts/${id}/remind`, { method: "POST" });
      const json = (await res.json()) as { error?: string; warning?: string | null; created?: boolean };
      if (!res.ok) {
        toast.error(
          json.error === "automatic_cap"
            ? "Two automatic reminders already went out. That is the ceiling."
            : json.error === "unsubscribed"
              ? "This address is unsubscribed or bounced."
              : json.error === "out_of_stock"
                ? "Every item in the snapshot is out of stock."
                : json.error === "recovered"
                  ? "This checkout was already recovered."
                  : "Could not send reminder",
        );
        return;
      }
      if (json.warning) toast(json.warning, { icon: "!" });
      toast.success(json.created ? "Reminder queued" : "Already queued (same reminder)");
    } catch {
      toast.error("Could not send reminder");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return <p className="mt-8 font-body text-sm text-[#6B6B68]">No captured checkouts yet.</p>;
  }

  return (
    <div className="-mx-4 mt-8 overflow-x-auto rounded-sm border border-sand bg-canvas px-4 md:mx-0 md:px-0">
      <table className="w-full min-w-[960px] text-left text-sm text-charcoal">
        <thead className="text-[#A8A8A4]">
          <tr>
            <th className="p-3">Email</th>
            <th className="p-3">Items</th>
            <th className="p-3">Value</th>
            <th className="p-3">Step</th>
            <th className="p-3">Last active</th>
            <th className="p-3">Reminders</th>
            <th className="p-3">Recovered</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-sand">
              <td className="p-3 text-xs">{r.email}</td>
              <td className="p-3 text-xs">{r.itemsLabel}</td>
              <td className="p-3">{r.valueLabel}</td>
              <td className="p-3">{r.furthestStep}</td>
              <td className="p-3 text-xs">{r.lastActiveAt}</td>
              <td className="p-3">{r.remindersSent}</td>
              <td className="p-3">{r.recovered ? "Yes" : "—"}</td>
              <td className="p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {r.whatsappUrl ? (
                    <a href={r.whatsappUrl} target="_blank" rel="noreferrer" className="text-xs text-gold hover:underline">
                      WhatsApp
                    </a>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy === r.id || r.recovered || r.remindersSent >= 2}
                    onClick={() => void remind(r.id)}
                    className="text-xs text-choc underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
                  >
                    {r.remindersSent >= 2 ? "Cap reached" : busy === r.id ? "Sending…" : "Send reminder"}
                  </button>
                </div>
                {r.recentWarning && r.remindersSent < 2 && !r.recovered ? (
                  <p className="mt-1 text-[11px] text-[#6B6B68]">Automatic reminder was recent.</p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
