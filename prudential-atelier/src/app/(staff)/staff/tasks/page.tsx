"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

type TaskRow = {
  id: string;
  orderId: string;
  orderRef: string;
  outfitDescription: string | null;
  role: string;
  assignedAt: string;
  completedAt: string | null;
  deliveryDate: string | null;
  status: string;
};

export default function StaffTasksPage() {
  const [filter, setFilter] = useState<"active" | "completed" | "all">("active");
  const [items, setItems] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetch(`/api/staff/tasks?filter=${filter}`)
      .then((r) => r.json())
      .then((d) => setItems((d as { items: TaskRow[] }).items ?? []))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-ink">My tasks</h1>

      <div className="flex gap-2">
        {(["active", "completed", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 font-sans text-xs capitalize ${
              filter === f ? "bg-choc text-cream" : "bg-bg-card text-text-mid border border-sand"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-choc" />
      ) : items.length === 0 ? (
        <p className="font-sans text-sm text-text-mid">No tasks in this view.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/staff/orders/${item.orderId}`}
                className="flex items-center justify-between staff-card px-4 py-3"
              >
                <div>
                  <p className="font-sans text-xs text-lightbr">{item.orderRef}</p>
                  <p className="font-sans text-sm text-ink">{item.outfitDescription ?? "Order"}</p>
                  <p className="font-sans text-xs text-text-mid">
                    {item.role} · Assigned {format(new Date(item.assignedAt), "d MMM")}
                  </p>
                </div>
                <Badge variant={item.status === "Completed" ? "success" : "gold"}>{item.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
