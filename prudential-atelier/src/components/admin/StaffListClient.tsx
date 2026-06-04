"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { BulkSelectTable, type BulkColumn } from "@/components/ui/BulkSelectTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type StaffRow = {
  id: string;
  department: string;
  employmentType: string;
  isActive: boolean;
  user: { name: string | null; email: string; phone: string | null };
  assignments: { id: string }[];
};

export function StaffListClient() {
  const [items, setItems] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [active, setActive] = useState("all");

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (department !== "all") params.set("department", department);
    if (active !== "all") params.set("active", active);
    const res = await fetch(`/api/staff?${params}`);
    if (!res.ok) {
      toast.error("Failed to load staff");
      return;
    }
    const data = (await res.json()) as { items: StaffRow[] };
    setItems(data.items);
    setLoading(false);
  }, [search, department, active]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 300);
    return () => clearTimeout(t);
  }, [refresh]);

  const handleBulkDelete = async (ids: string[]) => {
    const results = await Promise.all(
      ids.map((id) => fetch(`/api/staff/${id}`, { method: "DELETE" })),
    );
    if (results.some((r) => !r.ok)) {
      toast.error("Some deletions failed");
    } else {
      toast.success(`Deleted ${ids.length} staff member(s)`);
    }
    await refresh();
  };

  const columns: BulkColumn<StaffRow>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        cell: (row) => (
          <Link
            href={`/admin/staff/${row.id}`}
            className="font-sans text-sm font-medium text-nut hover:underline"
          >
            {row.user.name ?? row.user.email}
          </Link>
        ),
      },
      {
        key: "email",
        header: "Email",
        cell: (row) => (
          <span className="font-sans text-xs text-text-mid">{row.user.email}</span>
        ),
      },
      {
        key: "department",
        header: "Department",
        cell: (row) => (
          <span className="font-sans text-xs uppercase text-text-mid">
            {row.department.replace(/_/g, " ")}
          </span>
        ),
      },
      {
        key: "type",
        header: "Type",
        cell: (row) => (
          <Badge variant={row.employmentType === "FREELANCER" ? "gold" : "grey"} size="sm">
            {row.employmentType}
          </Badge>
        ),
      },
      {
        key: "assignments",
        header: "Active Orders",
        cell: (row) => (
          <span className="font-sans text-xs text-text-mid">{row.assignments.length}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (row) => (
          <Badge variant={row.isActive ? "success" : "wine"} size="sm">
            {row.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">People</p>
          <h1 className="font-display text-2xl text-ink">Staff Directory</h1>
          <p className="mt-1 font-sans text-sm text-text-mid">
            Manage atelier team members and assignments
          </p>
        </div>
        <Link href="/admin/staff/new">
          <Button>Add Staff Member</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded border border-sand bg-white px-3 py-2 font-sans text-sm"
        />
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="rounded border border-sand bg-white px-3 py-2 font-sans text-sm"
        >
          <option value="all">All departments</option>
          {["TAILOR", "BEADER", "DESIGNER", "PATTERN_CUTTER", "GENERAL"].map((d) => (
            <option key={d} value={d}>
              {d.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={active}
          onChange={(e) => setActive(e.target.value)}
          className="rounded border border-sand bg-white px-3 py-2 font-sans text-sm"
        >
          <option value="all">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-text-mid">Loading staff…</p>
      ) : items.length === 0 ? (
        <div className="card-surface flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="font-display text-xl text-ink">No staff members yet</p>
          <Link href="/admin/staff/new" className="mt-6">
            <Button>Add Staff Member</Button>
          </Link>
        </div>
      ) : (
        <BulkSelectTable
          columns={columns}
          data={items}
          onBulkDelete={handleBulkDelete}
          emptyMessage="No staff match your filters."
        />
      )}
    </div>
  );
}
