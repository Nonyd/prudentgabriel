"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";

type ActivityRow = {
  id: string;
  createdAt: string;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  module: string;
  description: string;
  recordId: string | null;
};

export function ActivityLogClient() {
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("all");
  const [action, setAction] = useState("all");

  const refresh = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("search", search);
    if (module !== "all") params.set("module", module);
    if (action !== "all") params.set("action", action);
    const res = await fetch(`/api/logs/activity?${params}`);
    if (!res.ok) {
      toast.error("Failed to load activity logs");
      return;
    }
    const data = (await res.json()) as { items: ActivityRow[]; total: number };
    setItems(data.items);
    setTotal(data.total);
    setLoading(false);
  }, [page, search, module, action]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 300);
    return () => clearTimeout(t);
  }, [refresh]);

  function exportCsv() {
    const header = ["Timestamp", "User", "Role", "Action", "Module", "Description"];
    const rows = items.map((r) =>
      [
        r.createdAt,
        r.userEmail ?? "",
        r.userRole ?? "",
        r.action,
        r.module,
        r.description.replace(/"/g, '""'),
      ].map((c) => `"${c}"`).join(","),
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "activity-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">System</p>
          <h1 className="font-display text-2xl text-ink">Activity Log</h1>
          <p className="mt-1 font-sans text-sm text-text-mid">{total} entries · read only</p>
        </div>
        <Button variant="secondary" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search email or description…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          className="min-w-[200px] flex-1 rounded border border-sand bg-white px-3 py-2 font-sans text-sm"
        />
        <input
          placeholder="Module"
          value={module === "all" ? "" : module}
          onChange={(e) => {
            setPage(1);
            setModule(e.target.value || "all");
          }}
          className="w-32 rounded border border-sand bg-white px-3 py-2 font-sans text-sm"
        />
        <select
          value={action}
          onChange={(e) => {
            setPage(1);
            setAction(e.target.value);
          }}
          className="rounded border border-sand bg-white px-3 py-2 font-sans text-sm"
        >
          <option value="all">All actions</option>
          {["CREATE", "UPDATE", "DELETE", "STAFF_CLOCK_IN", "STAFF_CLOCK_OUT"].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="card-surface overflow-hidden">
        {loading ? (
          <p className="p-6 font-sans text-sm text-text-mid">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead>
                <tr className="border-b border-sand bg-bg/50 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-text-light">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-sand/60">
                    <td className="px-4 py-3 font-sans text-xs text-text-mid whitespace-nowrap">
                      {formatDate(row.createdAt, "PP p")}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-sans text-xs">{row.userEmail ?? "—"}</p>
                      {row.userRole ? (
                        <p className="font-sans text-[10px] uppercase text-text-light">{row.userRole}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="grey" size="sm">
                        {row.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-sans text-xs">{row.module}</td>
                    <td className="px-4 py-3 font-sans text-sm text-text-mid">{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <span className="font-sans text-xs text-text-mid">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
