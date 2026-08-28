"use client";

import type { OrderStatus } from "@prisma/client";
import clsx from "clsx";

const DELIVERY_LABELS = ["Placed", "Confirmed", "Processing", "Shipped", "Delivered"] as const;
const DELIVERY_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

const PICKUP_LABELS = ["Placed", "Confirmed", "Processing", "Ready", "Collected"] as const;
const PICKUP_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "READY_FOR_COLLECTION",
  "COLLECTED",
];

function stepIndex(status: OrderStatus, statuses: OrderStatus[]): number {
  if (status === "CANCELLED" || status === "REFUNDED") return 0;
  const i = statuses.indexOf(status);
  return i === -1 ? 0 : i;
}

export function OrderTimeline({
  status,
  pickup = false,
}: {
  status: OrderStatus;
  pickup?: boolean;
}) {
  const labels = pickup ? PICKUP_LABELS : DELIVERY_LABELS;
  const statuses = pickup ? PICKUP_STATUSES : DELIVERY_STATUSES;
  const current = stepIndex(status, statuses);
  const cancelled = status === "CANCELLED" || status === "REFUNDED";

  return (
    <div className="flex justify-between gap-1 overflow-x-auto pb-2">
      {labels.map((label, idx) => {
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={label} className="flex min-w-[56px] flex-1 flex-col items-center text-center">
            <div
              className={clsx(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-medium",
                done && "border-wine bg-wine text-ivory",
                active && !done && !cancelled && "border-gold bg-wine text-gold",
                !done && !active && "border-border bg-ivory text-charcoal-light",
                cancelled && active && "border-error bg-ivory text-error",
              )}
            >
              {cancelled && active ? "✕" : done ? "✓" : idx + 1}
            </div>
            <span className="mt-2 font-label text-[9px] uppercase leading-tight text-charcoal-mid">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
