"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { UNCATEGORIZED_SLUG } from "@/lib/shop-category-slug";

export type AdminShopCategory = {
  slug: string;
  label: string;
  locked: boolean;
  productCount: number;
};

const fieldClass =
  "mt-2 w-full min-h-[44px] rounded-xl border border-sand bg-cream px-4 py-3 font-body text-base text-choc";

export function ProductCategoryField({
  value,
  onChange,
}: {
  value: string;
  onChange: (slug: string) => void;
}) {
  const [items, setItems] = useState<AdminShopCategory[]>([]);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/shop-categories", { credentials: "include" });
    const data = (await res.json()) as { items?: AdminShopCategory[]; error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "Could not load categories.");
      return;
    }
    setItems(data.items ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = items.find((item) => item.slug === value);

  const saveNew = async () => {
    const label = newLabel.trim();
    if (!label) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/shop-categories", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = (await res.json()) as { item?: AdminShopCategory; error?: string };
      if (!res.ok || !data.item) {
        throw new Error(data.error ?? "Could not add that category.");
      }
      setItems((cur) =>
        [...cur.filter((item) => item.slug !== data.item!.slug), data.item!].sort(
          (a, b) => a.label.localeCompare(b.label),
        ),
      );
      onChange(data.item.slug);
      setNewLabel("");
      setAdding(false);
      toast.success(`${data.item.label} is ready to use.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add that category.");
    } finally {
      setBusy(false);
    }
  };

  const removeSelected = async () => {
    if (!selected || selected.locked) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/shop-categories/${encodeURIComponent(selected.slug)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; moved?: number };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not remove that category.");
      }
      onChange(UNCATEGORIZED_SLUG);
      setConfirmRemove(false);
      await load();
      const moved = data.moved ?? 0;
      toast.success(
        moved === 0
          ? `${selected.label} was removed.`
          : `${selected.label} was removed. ${moved} piece${moved === 1 ? "" : "s"} moved to Uncategorized.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove that category.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setConfirmRemove(false);
        }}
        className={fieldClass}
      >
        {items.length === 0 ? <option value={value}>{value.replace(/_/g, " ")}</option> : null}
        {items.map((item) => (
          <option key={item.slug} value={item.slug}>
            {item.label}
          </option>
        ))}
      </select>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          type="button"
          className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-gold hover:underline"
          onClick={() => {
            setAdding((v) => !v);
            setConfirmRemove(false);
          }}
        >
          {adding ? "Cancel" : "Add a category"}
        </button>
        {selected && !selected.locked ? (
          <button
            type="button"
            className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-wine hover:underline"
            onClick={() => {
              setConfirmRemove(true);
              setAdding(false);
            }}
          >
            Remove this category
          </button>
        ) : null}
      </div>

      {adding ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveNew();
              }
            }}
            placeholder="e.g. Resort"
            className={fieldClass + " mt-0"}
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy || newLabel.trim().length < 2}
            onClick={() => void saveNew()}
            className="min-h-[44px] shrink-0 rounded-xl bg-wine px-4 font-label text-xs uppercase tracking-wide text-gold hover:bg-wine-hover disabled:opacity-50"
          >
            Save category
          </button>
        </div>
      ) : null}

      {confirmRemove && selected ? (
        <div className="mt-3 rounded-xl border border-sand bg-canvas px-4 py-3">
          <p className="font-body text-sm text-choc">
            Remove {selected.label}? Existing pieces stay in the catalogue and move to Uncategorized.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void removeSelected()}
              className="rounded-xl bg-wine px-4 py-2 font-label text-xs uppercase tracking-wide text-gold hover:bg-wine-hover disabled:opacity-50"
            >
              Remove {selected.label}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmRemove(false)}
              className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-choc/70 hover:underline"
            >
              Keep it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
