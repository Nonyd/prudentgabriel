"use client";

import { useEffect, useState } from "react";

type HistoryRow = {
  id: string;
  userEmail: string | null;
  description: string;
  createdAt: string;
};

export function PermissionHistory({
  recordId,
  recordType,
}: {
  recordId: string;
  recordType: "Role" | "User";
}) {
  const [items, setItems] = useState<HistoryRow[]>([]);

  useEffect(() => {
    const params = new URLSearchParams({ recordId, recordType });
    void fetch(`/api/admin/permissions/history?${params}`)
      .then((r) => r.json())
      .then((d) => setItems((d as { items: HistoryRow[] }).items ?? []));
  }, [recordId, recordType]);

  return (
    <div>
      <p className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-mid">
        History
      </p>
      {items.length === 0 ? (
        <p className="font-sans text-xs text-text-light">No permission changes yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((row) => (
            <li key={row.id} className="border-b border-sand/60 pb-2">
              <p className="font-sans text-xs text-text-dark">{row.description}</p>
              <p className="mt-0.5 font-sans text-[10px] uppercase tracking-[0.12em] text-text-light">
                {row.userEmail ?? "system"} · {new Date(row.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
