import Link from "next/link";

export type OutOfStockRow = {
  productId: string;
  productName: string;
  size: string;
};

export function OutOfStockPanel({ rows }: { rows: OutOfStockRow[] }) {
  return (
    <div className="card-surface p-6">
      <div className="flex items-center justify-between">
        <p className="panel-title font-sans font-semibold uppercase text-text-light">Out of stock</p>
        {rows.length > 0 ? (
          <span className="bg-wine/10 px-2 py-0.5 font-sans text-[10px] text-wine">{rows.length}</span>
        ) : null}
      </div>
      <ul className="mt-4 divide-y divide-sand/80">
        {rows.length === 0 ? (
          <li className="py-3 font-sans text-sm text-text-mid">Every published size has units on the rail.</li>
        ) : (
          rows.map((r) => (
            <li key={`${r.productId}-${r.size}`} className="flex items-center justify-between gap-2 py-3">
              <span className="min-w-0 truncate font-sans text-sm text-choc">
                {r.productName} <span className="text-text-mid">({r.size})</span>
              </span>
              <Link
                href={`/admin/products/${r.productId}/stock`}
                className="shrink-0 font-sans text-[11px] uppercase tracking-wide text-nut hover:underline"
              >
                History
              </Link>
            </li>
          ))
        )}
      </ul>
      <Link
        href="/admin/products?stock=out"
        className="mt-4 inline-block font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-nut"
      >
        View catalogue
      </Link>
    </div>
  );
}
