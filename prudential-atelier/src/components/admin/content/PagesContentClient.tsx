"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ExternalLink, GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { AdminImageUrlField } from "@/components/admin/AdminImageUrlField";
import { CmsRichTextEditor } from "@/components/admin/content/CmsRichTextEditor";
import { HeroCarouselEditor } from "@/components/admin/content/HeroCarouselEditor";
import {
  CMS_PAGE_GROUPS,
  CMS_PAGES,
  getFieldDefault,
  getPageById,
  type CmsField,
  type CmsPageDef,
} from "@/lib/cms-config";

type LinkItem = { label: string; url: string };

function parseMessages(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* ignore */
  }
  return raw ? [raw] : [];
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: CmsField;
  value: string;
  onChange: (v: string) => void;
}) {
  const base =
    "w-full rounded-[3px] border border-sand px-3 py-2 font-sans text-sm text-ink focus:border-choc focus:outline-none";

  if (field.type === "toggle") {
    const on = value === "true" || value === "1";
    return (
      <div className="flex items-center gap-3">
        <Toggle
          checked={on}
          onChange={(v) => onChange(v ? "true" : "false")}
          srLabel={field.label}
        />
        <span className="font-sans text-sm text-text-mid">{on ? "On" : "Off"}</span>
      </div>
    );
  }

  if (field.type === "textarea") {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} className={base} />;
  }

  if (field.type === "number") {
    return (
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className={base} min={0} />
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "image") {
    return (
      <AdminImageUrlField
        label=""
        value={value}
        onChange={onChange}
        folder={field.uploadFolder ?? "prudent-gabriel/cms"}
      />
    );
  }

  if (field.type === "richtext") {
    return <CmsRichTextEditor value={value} onChange={onChange} placeholder={field.placeholder} />;
  }

  if (field.type === "carousel") {
    return <HeroCarouselEditor value={value} onChange={onChange} />;
  }

  if (field.type === "messages") {
    const items = parseMessages(value);
    return (
      <div className="space-y-2">
        {items.map((msg, i) => (
          <div key={i} className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 shrink-0 text-sand" />
            <input
              value={msg}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(JSON.stringify(next));
              }}
              className={`${base} flex-1`}
            />
            <button
              type="button"
              onClick={() => onChange(JSON.stringify(items.filter((_, j) => j !== i)))}
              className="text-text-light hover:text-danger"
              aria-label="Remove message"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange(JSON.stringify([...items, ""]))}
          className="flex items-center gap-1 font-sans text-xs text-choc hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Add message
        </button>
      </div>
    );
  }

  if (field.type === "links") {
    let items: LinkItem[] = [];
    try {
      items = JSON.parse(value || "[]") as LinkItem[];
      if (!Array.isArray(items)) items = [];
    } catch {
      items = [];
    }
    return (
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-2">
            <input
              placeholder="Label"
              value={item.label}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...next[i], label: e.target.value };
                onChange(JSON.stringify(next));
              }}
              className={base}
            />
            <div className="flex gap-2">
              <input
                placeholder="URL"
                value={item.url}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...next[i], url: e.target.value };
                  onChange(JSON.stringify(next));
                }}
                className={`${base} flex-1`}
              />
              <button
                type="button"
                onClick={() => onChange(JSON.stringify(items.filter((_, j) => j !== i)))}
                className="text-text-light hover:text-danger"
                aria-label="Remove link"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange(JSON.stringify([...items, { label: "", url: "" }]))}
          className="flex items-center gap-1 font-sans text-xs text-choc hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Add link
        </button>
      </div>
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={base}
    />
  );
}

function formatLastEdited(iso: string | null): string {
  if (!iso) return "Never edited";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PageEditor({ page }: { page: CmsPageDef }) {
  const defaults = useMemo(() => {
    const d: Record<string, string> = {};
    for (const section of page.sections) {
      for (const field of section.fields) d[field.key] = field.default;
    }
    return d;
  }, [page]);

  const [values, setValues] = useState<Record<string, string>>(defaults);
  const [lastEdited, setLastEdited] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/content/pages?pageId=${encodeURIComponent(page.id)}`);
      if (res.ok) {
        const data = (await res.json()) as { values: Record<string, string>; lastEdited: string | null };
        setValues({ ...defaults, ...data.values });
        setLastEdited(data.lastEdited);
      } else {
        setValues(defaults);
      }
    } finally {
      setLoading(false);
    }
  }, [page.id, defaults]);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  const saveSection = async (sectionId: string) => {
    const section = page.sections.find((s) => s.id === sectionId);
    if (!section) return;
    setSaving(true);
    try {
      const patch: Record<string, string> = {};
      for (const f of section.fields) patch[f.key] = values[f.key] ?? getFieldDefault(f.key);
      const res = await fetch("/api/admin/content/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: page.id, values: patch }),
      });
      if (!res.ok) {
        toast.error("Failed to save");
        return;
      }
      toast.success(`${section.label} saved`);
      void load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-choc" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-ink">{page.label}</h2>
          <p className="mt-1 font-sans text-xs text-text-light">Last edited: {formatLastEdited(lastEdited)}</p>
        </div>
        {page.previewPath ? (
          <Link
            href={page.previewPath}
            target="_blank"
            className="inline-flex items-center gap-1.5 font-sans text-xs text-choc hover:underline"
          >
            Live preview <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      {page.sections.map((section) => (
        <div key={section.id} className="rounded-lg border border-sand bg-white p-5">
          <h3 className="mb-4 font-sans text-sm font-semibold text-ink">{section.label}</h3>
          <div className="space-y-4">
            {section.fields.map((field) => (
              <div key={field.key}>
                <label className="mb-1.5 block font-sans text-xs font-medium text-text-mid">{field.label}</label>
                <FieldInput
                  field={field}
                  value={values[field.key] ?? field.default}
                  onChange={(v) => setField(field.key, v)}
                />
              </div>
            ))}
          </div>
          <Button className="mt-5" onClick={() => void saveSection(section.id)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Save ${section.label}`}
          </Button>
        </div>
      ))}
    </div>
  );
}

export function PagesContentClient() {
  const [selectedId, setSelectedId] = useState(CMS_PAGES[0].id);
  const page = getPageById(selectedId) ?? CMS_PAGES[0];

  const pageById = useMemo(() => Object.fromEntries(CMS_PAGES.map((p) => [p.id, p])), []);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/content"
          className="mb-4 inline-block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-light hover:text-choc"
        >
          ← Content
        </Link>
        <p className="eyebrow">Content</p>
        <h1 className="font-display text-2xl text-ink">Page content</h1>
        <p className="mt-1 font-sans text-sm text-text-mid">
          Edit live copy and images section by section. Changes save per section.
        </p>
      </div>

      <div className="rounded-lg border border-sand/80 bg-white px-4 py-3">
        <p className="font-sans text-[13px] leading-relaxed text-text-mid">
          Page-specific images are edited here. Global logos and fallback hero images are in{" "}
          <Link href="/admin/settings/appearance" className="text-choc hover:underline">
            Appearance settings
          </Link>
          . Portfolio grids are managed in the{" "}
          <Link href="/admin/gallery" className="text-choc hover:underline">
            gallery
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav className="space-y-5" aria-label="Pages">
          {CMS_PAGE_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="mb-1.5 px-3 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.pageIds.map((pageId) => {
                  const p = pageById[pageId];
                  if (!p) return null;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(p.id)}
                        className={`w-full rounded-sm px-3 py-2 text-left font-sans text-sm transition-colors ${
                          selectedId === p.id
                            ? "bg-choc/10 font-medium text-choc"
                            : "text-text-mid hover:bg-sand/30"
                        }`}
                      >
                        {p.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div>
          <PageEditor key={page.id} page={page} />
        </div>
      </div>
    </div>
  );
}
