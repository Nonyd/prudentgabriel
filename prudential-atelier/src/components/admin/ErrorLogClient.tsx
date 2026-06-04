"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { ErrorSeverity } from "@prisma/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";

type ErrorRow = {
  id: string;
  createdAt: string;
  severity: ErrorSeverity;
  errorType: string;
  message: string;
  stackTrace: string | null;
  resolved: boolean;
  userId: string | null;
  orderId: string | null;
};

function severityBadge(severity: ErrorSeverity) {
  const map: Record<ErrorSeverity, "grey" | "gold" | "wine"> = {
    INFO: "grey",
    WARNING: "gold",
    CRITICAL: "wine",
  };
  return <Badge variant={map[severity]}>{severity}</Badge>;
}

export function ErrorLogClient() {
  const [items, setItems] = useState<ErrorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [resolved, setResolved] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolving, setResolving] = useState(false);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("search", search);
    if (severity !== "all") params.set("severity", severity);
    if (resolved !== "all") params.set("resolved", resolved);
    const res = await fetch(`/api/logs/errors?${params}`);
    if (!res.ok) {
      toast.error("Failed to load error logs");
      return;
    }
    const data = (await res.json()) as { items: ErrorRow[]; total: number };
    setItems(data.items);
    setTotal(data.total);
    setLoading(false);
  }, [page, search, severity, resolved]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 300);
    return () => clearTimeout(t);
  }, [refresh]);

  async function markResolved() {
    if (!resolveId) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/logs/errors/${resolveId}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolveNote }),
      });
      if (!res.ok) {
        toast.error("Failed to resolve");
        return;
      }
      toast.success("Marked resolved");
      setResolveId(null);
      setResolveNote("");
      await refresh();
    } finally {
      setResolving(false);
    }
  }

  function exportCsv() {
    const header = ["Timestamp", "Severity", "Type", "Message", "Resolved"];
    const rows = items.map((r) =>
      [r.createdAt, r.severity, r.errorType, r.message.replace(/"/g, '""'), r.resolved]
        .map((c) => `"${c}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "error-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">System</p>
          <h1 className="font-display text-2xl text-ink">Error Log</h1>
          <p className="mt-1 font-sans text-sm text-text-mid">{total} entries</p>
        </div>
        <Button variant="secondary" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search message or type…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          className="min-w-[200px] flex-1 rounded border border-sand bg-white px-3 py-2 font-sans text-sm"
        />
        <select
          value={severity}
          onChange={(e) => {
            setPage(1);
            setSeverity(e.target.value);
          }}
          className="rounded border border-sand bg-white px-3 py-2 font-sans text-sm"
        >
          <option value="all">All severities</option>
          {(["INFO", "WARNING", "CRITICAL"] as ErrorSeverity[]).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={resolved}
          onChange={(e) => {
            setPage(1);
            setResolved(e.target.value);
          }}
          className="rounded border border-sand bg-white px-3 py-2 font-sans text-sm"
        >
          <option value="all">All</option>
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
        </select>
      </div>

      <div className="card-surface overflow-hidden">
        {loading ? (
          <p className="p-6 font-sans text-sm text-text-mid">Loading…</p>
        ) : (
          <div className="divide-y divide-sand/60">
            {items.map((row) => (
              <div key={row.id}>
                <div className="flex w-full flex-wrap items-start gap-3 px-4 py-4 hover:bg-bg/50">
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                    className="flex min-w-0 flex-1 flex-wrap items-start gap-3 text-left"
                  >
                    <span className="font-sans text-xs text-text-mid whitespace-nowrap">
                      {formatDate(row.createdAt, "PP p")}
                    </span>
                    {severityBadge(row.severity)}
                    <span className="font-sans text-xs font-medium text-ink">{row.errorType}</span>
                    <span className="min-w-0 flex-1 truncate font-sans text-sm text-text-mid">
                      {row.message}
                    </span>
                  </button>
                  {row.resolved ? (
                    <Badge variant="success" size="sm">
                      Resolved
                    </Badge>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setResolveId(row.id)}>
                      Resolve
                    </Button>
                  )}
                </div>
                {expanded === row.id && row.stackTrace ? (
                  <pre className="overflow-x-auto bg-choc/5 px-4 py-3 font-mono text-[11px] text-text-mid">
                    {row.stackTrace}
                  </pre>
                ) : null}
              </div>
            ))}
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

      <Modal open={!!resolveId} onClose={() => setResolveId(null)} title="Mark as resolved">
        <textarea
          rows={3}
          value={resolveNote}
          onChange={(e) => setResolveNote(e.target.value)}
          placeholder="Resolution notes (optional)"
          className="mt-4 w-full rounded border border-sand px-3 py-2 font-sans text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setResolveId(null)}>
            Cancel
          </Button>
          <Button loading={resolving} onClick={() => void markResolved()}>
            Confirm
          </Button>
        </div>
      </Modal>
    </div>
  );
}
