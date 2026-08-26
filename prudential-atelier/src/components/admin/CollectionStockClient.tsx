"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

type Variant = { id: string; size: string; sku: string | null; stock: number };
type ProductRow = {
  id: string;
  name: string;
  slug: string;
  isPublished: boolean;
  variants: Variant[];
};

export function CollectionStockClient({ collectionId }: { collectionId: string }) {
  const [name, setName] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [stock, setStock] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch(`/api/admin/collections/${collectionId}/stock`)
      .then((r) => r.json())
      .then((j: { collection?: { name: string }; products?: ProductRow[] }) => {
        setName(j.collection?.name ?? "");
        const rows = j.products ?? [];
        setProducts(rows);
        const next: Record<string, string> = {};
        for (const p of rows) {
          for (const v of p.variants) next[v.id] = String(v.stock);
        }
        setStock(next);
      })
      .finally(() => setLoading(false));
  }, [collectionId]);

  async function save() {
    const updates = Object.entries(stock).map(([variantId, value]) => ({
      variantId,
      stock: Math.max(0, Math.floor(Number(value) || 0)),
    }));
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/collections/${collectionId}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) toast.error("Save failed");
      else toast.success("Stock saved");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="font-body text-sm text-[#6B6B68]">Loading…</p>;
  }

  return (
    <div>
      <Link href={`/admin/collections/${collectionId}`} className="font-body text-sm text-[#6B6B68] hover:text-olive">
        ← {name || "Collection"}
      </Link>
      <h1 className="mt-2 font-display text-2xl text-ink">Bulk stock</h1>
      <p className="mt-1 font-body text-[13px] text-[#6B6B68]">
        Set size stock for every piece in this collection, including the imported zeros.
      </p>

      <div className="mt-8 space-y-8">
        {products.map((p) => (
          <section key={p.id} className="border border-sand bg-[#FAFAFA] p-4">
            <p className="font-body text-[14px] font-medium text-ink">
              {p.name}{" "}
              {!p.isPublished ? <span className="text-[11px] uppercase text-[#6B6B68]">draft</span> : null}
            </p>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="font-label text-[11px] uppercase text-[#6B6B68]">
                <tr>
                  <th className="py-1">Size</th>
                  <th className="py-1">SKU</th>
                  <th className="py-1">Stock</th>
                </tr>
              </thead>
              <tbody>
                {p.variants.map((v) => (
                  <tr key={v.id} className="border-t border-sand/60">
                    <td className="py-2">{v.size}</td>
                    <td className="py-2 font-mono text-[11px] text-[#6B6B68]">{v.sku ?? "—"}</td>
                    <td className="py-2">
                      <input
                        type="number"
                        min={0}
                        className="w-24 border border-sand bg-white px-2 py-1"
                        value={stock[v.id] ?? "0"}
                        onChange={(e) => setStock((s) => ({ ...s, [v.id]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="mt-6 bg-[#37392d] px-5 py-2 font-body text-[12px] uppercase tracking-wide text-white disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save stock"}
      </button>
    </div>
  );
}
