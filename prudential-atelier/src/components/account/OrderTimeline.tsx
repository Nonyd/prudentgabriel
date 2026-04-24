"use client";

import type { OrderStatus } from "@prisma/client";
import clsx from "clsx";

const LABELS = ["Placed", "Confirmed", "Processing", "Shipped", "Delivered"] as const;
const STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

function stepIndex(status: OrderStatus): number {
  if (status === "CANCELLED" || status === "REFUNDED") return 0;
  const i = STATUSES.indexOf(status);
  return i === -1 ? 0 : i;
}

export function OrderTimeline({ status }: { status: OrderStatus }) {
  const current = stepIndex(status);
  const cancelled = status === "CANCELLED" || status === "REFUNDED";

  return (
    <div className="flex justify-between gap-1 overflow-x-auto pb-2">
      {LABELS.map((label, idx) => {
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
