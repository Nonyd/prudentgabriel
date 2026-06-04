"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Loader2 } from "lucide-react";

const PAGE_KEYS = [
  { key: "page_about", label: "About page" },
  { key: "page_bespoke_process", label: "Bespoke process" },
  { key: "page_contact", label: "Contact information" },
  { key: "page_shipping", label: "Shipping & returns" },
  { key: "page_privacy", label: "Privacy policy" },
  { key: "page_terms", label: "Terms & conditions" },
  { key: "announcement_bar", label: "Announcement bar" },
  { key: "hero_headline", label: "Hero headline" },
  { key: "hero_subheadline", label: "Hero subheadline" },
];

export function PagesContentClient() {
  const [selected, setSelected] = useState(PAGE_KEYS[0].key);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/content/pages?key=${encodeURIComponent(key)}`);
      if (res.ok) {
        const data = (await res.json()) as { value: string };
        setContent(data.value ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(selected);
  }, [selected, load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/content/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: selected, value: content }),
      });
      if (!res.ok) {
        toast.error("Failed to save");
        return;
      }
      toast.success("Page content saved");
    } finally {
      setSaving(false);
    }
  };

  const current = PAGE_KEYS.find((p) => p.key === selected);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Content</p>
        <h1 className="font-display text-2xl text-ink">Pages</h1>
        <p className="mt-1 font-sans text-sm text-text-mid">Edit key website copy stored in site settings</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <ul className="space-y-1">
          {PAGE_KEYS.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => setSelected(p.key)}
                className={`w-full rounded-sm px-3 py-2 text-left font-sans text-sm ${
                  selected === p.key ? "bg-choc/10 text-choc" : "text-text-mid hover:bg-sand/30"
                }`}
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border border-sand bg-white p-4">
          <h2 className="mb-3 font-sans text-sm font-semibold text-ink">{current?.label}</h2>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-choc" />
          ) : (
            <>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                className="w-full rounded-[3px] border border-sand px-3 py-2 font-sans text-sm"
              />
              <Button className="mt-4" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
