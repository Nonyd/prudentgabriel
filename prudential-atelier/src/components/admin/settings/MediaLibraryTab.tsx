"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type MediaItem = { id: string; url: string; filename: string; createdAt: string };

export function MediaLibraryTab() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: MediaItem[]; totalPages: number; total: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/media?page=${page}`);
    if (res.ok) {
      const j = (await res.json()) as { items: MediaItem[]; totalPages: number; total: number };
      setData(j);
      setSelected(new Set());
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} item(s)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/media/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((j as { error?: string }).error ?? "Delete failed");
      }
      toast.success(`Deleted ${(j as { deleted?: number }).deleted ?? ids.length} item(s)`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const n = selected.size;

  return (
    <div className="rounded-sm border border-[#EBEBEA] bg-white p-6">
      <p className="font-body text-sm text-charcoal">Media library</p>
      <p className="mt-1 font-body text-xs text-[#6B6B68]">
        {data?.total ?? 0} files stored. Select items to delete in bulk.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(data?.items ?? []).map((m) => {
          const on = selected.has(m.id);
          return (
            <label
              key={m.id}
              className={`relative cursor-pointer border p-2 ${on ? "border-olive ring-1 ring-olive" : "border-[#EBEBEA]"}`}
            >
              <input
                type="checkbox"
                className="absolute left-3 top-3 z-10 h-4 w-4 accent-olive"
                checked={on}
                onChange={() => toggle(m.id)}
              />
              <div
                className="aspect-square w-full bg-[#F5F5F3] bg-cover bg-center"
                style={{ backgroundImage: `url(${m.url})` }}
                role="img"
                aria-label={m.filename}
              />
              <p className="mt-1 truncate font-body text-[10px] text-[#6B6B68]">{m.filename}</p>
            </label>
          );
        })}
      </div>
      {data && data.totalPages > 1 && (
        <div className="mt-4 flex gap-2">
          <button type="button" className="text-xs text-olive" disabled={page < 2} onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <button
            type="button"
            className="text-xs text-olive"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {n > 0 && (
        <div className="fixed bottom-6 left-1/2 z-[85] flex -translate-x-1/2 items-center gap-4 rounded-sm border border-[#EBEBEA] bg-white px-5 py-3 shadow-lg">
          <span className="font-body text-sm text-charcoal">
            {n} selected —{" "}
            <button
              type="button"
              disabled={deleting}
              onClick={() => void bulkDelete()}
              className="font-medium text-red-700 underline disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete selected"}
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
