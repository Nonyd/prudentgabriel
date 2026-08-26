"use client";

import { useEffect, useState } from "react";

type Row = {
  email: string;
  unsubscribedAt: string | null;
  bounceAt: string | null;
  wasNewsletter: boolean;
};

export function UnsubscribesClient() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/admin/unsubscribes")
      .then((r) => r.json())
      .then((j: { items?: Row[] }) => setItems(j.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="mt-8 font-body text-sm text-[#6B6B68]">Loading…</p>;
  }

  if (items.length === 0) {
    return <p className="mt-8 font-body text-sm text-[#6B6B68]">No unsubscribes yet.</p>;
  }

  return (
    <table className="mt-8 w-full border border-sand bg-[#FAFAFA] text-left text-sm">
      <thead className="border-b border-sand font-label text-[11px] uppercase tracking-wide text-[#6B6B68]">
        <tr>
          <th className="p-3">Email</th>
          <th className="p-3">Unsubscribed</th>
          <th className="p-3">Newsletter</th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={row.email} className="border-b border-sand/60">
            <td className="p-3 font-body text-ink">{row.email}</td>
            <td className="p-3 font-body text-[#6B6B68]">
              {row.unsubscribedAt
                ? new Date(row.unsubscribedAt).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </td>
            <td className="p-3 font-body text-[#6B6B68]">{row.wasNewsletter ? "Yes" : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
