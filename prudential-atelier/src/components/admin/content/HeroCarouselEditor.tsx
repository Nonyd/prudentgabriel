"use client";

import { ChevronDown, ChevronUp, Film, ImageIcon, Plus, Trash2 } from "lucide-react";
import { AdminImageUrlField } from "@/components/admin/AdminImageUrlField";
import { parseHeroCarouselItems, type HeroCarouselItem } from "@/lib/hero-carousel";

function parseItems(raw: string): HeroCarouselItem[] {
  const items = parseHeroCarouselItems(raw);
  return items;
}

export function HeroCarouselEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const items = parseItems(value);

  const updateItems = (next: HeroCarouselItem[]) => {
    onChange(JSON.stringify(next));
  };

  const addItem = (type: "image" | "video") => {
    updateItems([...items, { type, url: "", alt: "" }]);
  };

  return (
    <div className="space-y-4 rounded-md border border-sand/80 bg-sand/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-text-mid">
          Hero media carousel
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => addItem("image")}
            className="inline-flex items-center gap-1 rounded-[3px] border border-sand bg-white px-3 py-1.5 font-sans text-xs text-choc hover:bg-sand/20"
          >
            <Plus className="h-3.5 w-3.5" /> Add image
          </button>
          <button
            type="button"
            onClick={() => addItem("video")}
            className="inline-flex items-center gap-1 rounded-[3px] border border-sand bg-white px-3 py-1.5 font-sans text-xs text-choc hover:bg-sand/20"
          >
            <Plus className="h-3.5 w-3.5" /> Add video
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="font-sans text-sm text-text-light">
          No carousel items yet. Add images or videos, or save to use the default fallback set on the live site.
        </p>
      ) : null}

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="rounded-md border border-sand bg-white p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-sand bg-sand/20">
                  {item.url && item.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  ) : item.type === "video" ? (
                    <Film className="h-4 w-4 text-text-light" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-text-light" />
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.1em] ${
                    item.type === "video"
                      ? "bg-choc/10 text-choc"
                      : "bg-sand/40 text-text-mid"
                  }`}
                >
                  {item.type}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => {
                    const next = [...items];
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    updateItems(next);
                  }}
                  className="rounded p-1 text-text-light hover:text-choc disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={index === items.length - 1}
                  onClick={() => {
                    const next = [...items];
                    [next[index], next[index + 1]] = [next[index + 1], next[index]];
                    updateItems(next);
                  }}
                  className="rounded p-1 text-text-light hover:text-choc disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => updateItems(items.filter((_, i) => i !== index))}
                  className="rounded p-1 text-text-light hover:text-danger"
                  aria-label="Remove item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {item.type === "image" ? (
                <AdminImageUrlField
                  label="Image URL"
                  value={item.url}
                  onChange={(url) => {
                    const next = [...items];
                    next[index] = { ...next[index], url };
                    updateItems(next);
                  }}
                  folder="prudent-gabriel/hero"
                />
              ) : (
                <div>
                  <label className="mb-1.5 block font-sans text-xs font-medium text-text-mid">
                    Video URL
                  </label>
                  <input
                    type="url"
                    value={item.url}
                    onChange={(e) => {
                      const next = [...items];
                      next[index] = { ...next[index], url: e.target.value };
                      updateItems(next);
                    }}
                    placeholder="https://..."
                    className="w-full rounded-[3px] border border-sand px-3 py-2 font-sans text-sm text-ink focus:border-choc focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block font-sans text-xs font-medium text-text-mid">
                  Alt text (optional)
                </label>
                <input
                  type="text"
                  value={item.alt ?? ""}
                  onChange={(e) => {
                    const next = [...items];
                    next[index] = { ...next[index], alt: e.target.value };
                    updateItems(next);
                  }}
                  className="w-full rounded-[3px] border border-sand px-3 py-2 font-sans text-sm text-ink focus:border-choc focus:outline-none"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
