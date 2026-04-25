"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import toast from "react-hot-toast";
import type { SettingType } from "@prisma/client";
import { FieldInput, patchGroup } from "@/components/admin/AdminSettingsClient";

type Row = {
  key: string;
  value: string;
  label: string;
  type: SettingType;
  isPublic: boolean;
  sortOrder: number;
};

const SECTIONS: { id: string; title: string; defaultOpen?: boolean; match: (r: Row) => boolean }[] = [
  {
    id: "home",
    title: "Homepage",
    defaultOpen: true,
    match: (r) => {
      if (r.key.startsWith("content_bespoke_page")) return false;
      return [
        "content_hero_",
        "content_rtw_",
        "content_bride_",
        "content_bespoke_",
        "content_atelier_",
        "content_newsletter_",
      ].some((p) => r.key.startsWith(p));
    },
  },
  { id: "announce", title: "Announcement bar", match: (r) => r.key.startsWith("content_announce_") },
  { id: "shop", title: "Shop page", match: (r) => r.key.startsWith("content_shop_") },
  { id: "consult", title: "Consultation page", match: (r) => r.key.startsWith("content_consult_") },
  { id: "bespoke", title: "Bespoke page", match: (r) => r.key.startsWith("content_bespoke_page_") },
  { id: "pfa", title: "PFA banner", match: (r) => r.key.startsWith("content_pfa_") },
  { id: "footer", title: "Footer", match: (r) => r.key.startsWith("content_footer_") },
];

function rowsForSection(rows: Row[], match: (r: Row) => boolean): Row[] {
  return rows.filter(match).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function ContentSettingsForm() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/settings/CONTENT");
    if (!res.ok) return;
    const j = (await res.json()) as { items: Row[] };
    setRows(j.items);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateVal = (key: string, value: string) => {
    setRows((prev) => (prev ? prev.map((r) => (r.key === key ? { ...r, value } : r)) : prev));
  };

  const saveAll = async () => {
    if (!rows?.length) return;
    setSaving(true);
    try {
      const updates = rows.map((r) => ({ key: r.key, value: r.value }));
      await patchGroup("CONTENT", updates);
      toast.success("Content updated. Changes live within 5 minutes ✓");
      toast("Changes take up to 5 minutes to appear due to caching.", { icon: "ℹ️" });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const sectionBlocks = useMemo(() => {
    if (!rows) return null;
    return SECTIONS.map((sec) => {
      const list = rowsForSection(rows, sec.match);
      if (!list.length) return null;
      return (
        <Accordion.Item key={sec.id} value={sec.id} className="border border-[#EBEBEA] bg-canvas px-4">
          <Accordion.Header>
            <Accordion.Trigger className="flex w-full items-center justify-between py-4 font-body text-xs font-medium uppercase tracking-[0.12em] text-ink">
              {sec.title}
              <span className="text-[11px] font-normal normal-case tracking-normal text-[#6B6B68]">
                {list.length} field{list.length === 1 ? "" : "s"}
              </span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="border-t border-[#EBEBEA] pb-6 pt-4">
            <div className="space-y-5">
              {list.map((row) => (
                <div key={row.key}>
                  <label className="font-body text-[11px] font-medium uppercase tracking-[0.1em] text-[#6B6B68]">
                    {row.label}
                  </label>
                  <div className="mt-1.5">
                    <FieldInput row={row} onChange={(v) => updateVal(row.key, v)} />
                  </div>
                </div>
              ))}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      );
    });
  }, [rows]);

  if (!rows) {
    return <p className="font-body text-sm text-[#6B6B68]">Loading content settings…</p>;
  }

  const defaultOpen = SECTIONS.filter((s) => s.defaultOpen).map((s) => s.id);

  return (
    <div className="space-y-6">
      <Accordion.Root type="multiple" defaultValue={defaultOpen} className="space-y-2">
        {sectionBlocks}
      </Accordion.Root>
      <button
        type="button"
        disabled={saving}
        onClick={() => void saveAll()}
        className="sticky bottom-4 z-10 w-full bg-[#37392d] py-3.5 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save all content"}
      </button>
    </div>
  );
}
