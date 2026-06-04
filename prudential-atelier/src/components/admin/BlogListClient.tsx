"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { BlogStatus } from "@prisma/client";
import { BulkSelectTable, type BulkColumn } from "@/components/ui/BulkSelectTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

type BlogRow = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  status: BlogStatus;
  publishedAt: string | null;
  authorName: string | null;
  updatedAt: string;
};

function statusBadge(status: BlogStatus) {
  const map: Record<BlogStatus, "grey" | "gold" | "success"> = {
    DRAFT: "grey",
    SCHEDULED: "gold",
    PUBLISHED: "success",
  };
  return <Badge variant={map[status]}>{status}</Badge>;
}

export function BlogListClient() {
  const [items, setItems] = useState<BlogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const res = await fetch(`/api/blog?${params}`);
    if (!res.ok) {
      toast.error("Failed to load posts");
      return;
    }
    const data = (await res.json()) as { items: BlogRow[] };
    setItems(data.items);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 300);
    return () => clearTimeout(t);
  }, [refresh]);

  const handleBulkDelete = async (ids: string[]) => {
    const results = await Promise.all(
      ids.map((id) => fetch(`/api/blog/${id}`, { method: "DELETE" })),
    );
    if (results.some((r) => !r.ok)) toast.error("Some deletions failed");
    else toast.success(`Deleted ${ids.length} post(s)`);
    await refresh();
  };

  const columns: BulkColumn<BlogRow>[] = useMemo(
    () => [
      {
        key: "title",
        header: "Title",
        cell: (row) => (
          <Link
            href={`/admin/content/blog/${row.id}/edit`}
            className="font-sans text-sm font-medium text-nut hover:underline"
          >
            {row.title}
          </Link>
        ),
      },
      {
        key: "category",
        header: "Category",
        cell: (row) => (
          <span className="font-sans text-xs text-text-mid">{row.category ?? "—"}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (row) => statusBadge(row.status),
      },
      {
        key: "published",
        header: "Publish date",
        cell: (row) => (
          <span className="font-sans text-xs text-text-mid">
            {row.publishedAt ? formatDate(row.publishedAt) : "—"}
          </span>
        ),
      },
      {
        key: "author",
        header: "Author",
        cell: (row) => (
          <span className="font-sans text-xs text-text-mid">{row.authorName ?? "—"}</span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Content</p>
          <h1 className="font-display text-2xl text-ink">Blog</h1>
          <p className="mt-1 font-sans text-sm text-text-mid">Manage journal posts and editorial content</p>
        </div>
        <Link href="/admin/content/blog/new">
          <Button>New Post</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search title or slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded border border-sand bg-white px-3 py-2 font-sans text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-sand bg-white px-3 py-2 font-sans text-sm"
        >
          <option value="all">All statuses</option>
          {(["DRAFT", "SCHEDULED", "PUBLISHED"] as BlogStatus[]).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-text-mid">Loading posts…</p>
      ) : (
        <BulkSelectTable
          columns={columns}
          data={items}
          onBulkDelete={handleBulkDelete}
          emptyMessage="No blog posts yet."
        />
      )}
    </div>
  );
}
