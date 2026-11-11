import Link from "next/link";
import type { ShippingDueItem } from "@/lib/shipping/due";

/** "Shipping payment pending" on her dashboard and orders, one row per order, each with its pay button. */
export function ShippingDueBanner({ items, className }: { items: ShippingDueItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <section
      className={`rounded-md border border-[#c9a96e] bg-[#fbf4e6] px-5 py-5 dark:border-sand/40 dark:bg-bg-card md:px-6 ${className ?? ""}`}
      aria-label="Shipping payment pending"
    >
      <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a6a2f]">
        Pending payment
      </p>
      <ul className="mt-3 space-y-4">
        {items.map((it) => (
          <li key={it.orderId} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-display text-lg text-choc dark:text-cream">
                Shipping for order #{it.orderNumber}
              </p>
              <p className="font-sans text-sm text-text-mid">
                {it.amountLabel} due{it.includesPiece ? " (your piece and shipping)" : ""}
                {it.carrier ? ` · ${it.carrier}` : ""}
              </p>
            </div>
            <Link href={it.payPath} className="btn-primary shrink-0 self-start px-6 py-3 text-[10px] tracking-[0.2em] sm:self-auto">
              Pay shipping
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
