"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Film, ImageIcon, Plus, Trash2 } from "lucide-react";
import { AdminImageUrlField } from "@/components/admin/AdminImageUrlField";
import { AdminVideoUrlField } from "@/components/admin/AdminVideoUrlField";
import { parseHeroCarouselEditorItems, type HeroCarouselItem } from "@/lib/hero-carousel";

export function HeroCarouselEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [items, setItems] = useState<HeroCarouselItem[]>(() => parseHeroCarouselEditorItems(value));

  useEffect(() => {
    setItems(parseHeroCarouselEditorItems(value));
  }, [value]);

  useEffect(() => {
    console.log("[HeroCarouselEditor] items:", items);
  }, [items]);

  const commitItems = useCallback(
    (next: HeroCarouselItem[]) => {
      setItems(next);
      onChange(JSON.stringify(next));
    },
    [onChange],
  );

  const handleAddImage = () => {
    commitItems([
      ...items,
      {
        type: "image" as const,
        url: "",
        alt: "",
      },
    ]);
  };

  const handleAddVideo = () => {
    commitItems([
      ...items,
      {
        type: "video" as const,
        url: "",
        alt: "",
      },
    ]);
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
            onClick={handleAddImage}
            className="inline-flex items-center gap-1 rounded-[3px] border border-sand bg-bg-card px-3 py-1.5 font-sans text-xs text-choc hover:bg-sand/20"
          >
            <Plus className="h-3.5 w-3.5" /> Add image
          </button>
          <button
            type="button"
            onClick={handleAddVideo}
            className="inline-flex items-center gap-1 rounded-[3px] border border-sand bg-bg-card px-3 py-1.5 font-sans text-xs text-choc hover:bg-sand/20"
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
          <div key={`${item.type}-${index}`} className="rounded-md border border-sand bg-bg-card p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-sand bg-sand/20">
                  {item.url && item.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  ) : item.url && item.type === "video" ? (
                    <video src={item.url} muted playsInline className="h-full w-full object-cover" />
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
                    commitItems(next);
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
                    commitItems(next);
                  }}
                  className="rounded p-1 text-text-light hover:text-choc disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => commitItems(items.filter((_, i) => i !== index))}
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
                    commitItems(next);
                  }}
                  folder="prudent-gabriel/hero"
                />
              ) : (
                <AdminVideoUrlField
                  label="Video"
                  value={item.url}
                  onChange={(url) => {
                    const next = [...items];
                    next[index] = { ...next[index], url };
                    commitItems(next);
                  }}
                  folder="prudent-gabriel/hero-videos"
                />
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
                    commitItems(next);
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
