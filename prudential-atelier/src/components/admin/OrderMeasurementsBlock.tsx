import { parseSnapshot } from "@/lib/custom-size";

export function OrderMeasurementsBlock({
  items,
}: {
  items: { product: { name: string }; sizeMode: string; measurements: unknown; typedUnit?: string | null }[];
}) {
  const custom = items.filter((i) => i.sizeMode === "CUSTOM");
  if (!custom.length) return null;
  return (
    <section className="glass-opaque p-6 print:break-inside-avoid">
      <h2 className="font-display text-xl text-choc">Workroom measurements</h2>
      <p className="mt-1 text-sm text-charcoal-mid">Cut from these figures. Canonical unit is centimetres.</p>
      <ul className="mt-4 space-y-4">
        {custom.map((it, idx) => {
          const snap = parseSnapshot(it.measurements);
          return (
            <li key={idx}>
              <p className="font-medium text-charcoal">{it.product.name}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
                {snap.map((e) => (
                  <div key={e.key}>
                    <dt className="text-[11px] uppercase tracking-wide text-[#A8A8A4]">{e.label}</dt>
                    <dd className="font-medium text-choc">
                      {e.valueCm} cm
                      {e.typedUnit !== "cm" ? ` · typed ${e.typedValue} ${e.typedUnit}` : ""}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
