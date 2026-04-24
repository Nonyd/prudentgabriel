"use client";

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import toast from "react-hot-toast";
import {
  EMAIL_TEMPLATE_META,
  getEffectiveTemplate,
  stringifyTemplate,
} from "@/lib/email-templates";

type Row = { key: string; value: string; label: string };

async function patchEmail(updates: { key: string; value: string }[]) {
  const res = await fetch("/api/admin/settings/EMAIL", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? "Save failed");
  }
}

const TEMPLATE_KEY_LIST = Object.keys(EMAIL_TEMPLATE_META).sort(
  (a, b) => (EMAIL_TEMPLATE_META[a]?.sortOrder ?? 0) - (EMAIL_TEMPLATE_META[b]?.sortOrder ?? 0),
);

export function EmailTemplatesEditor({
  emailRows,
  onSaved,
}: {
  emailRows: Row[];
  onSaved: () => void;
}) {
  const byKey = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of emailRows) {
      if (r.key.startsWith("email_tpl_")) m.set(r.key, r);
    }
    return m;
  }, [emailRows]);

  const [open, setOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const openEditor = (key: string) => {
    const row = byKey.get(key);
    const eff = getEffectiveTemplate(key, row?.value);
    setEditingKey(key);
    setSubject(eff.subject);
    setBody(eff.body);
    setOpen(true);
  };

  const save = async () => {
    if (!editingKey) return;
    setSaving(true);
    try {
      await patchEmail([{ key: editingKey, value: stringifyTemplate(subject, body) }]);
      toast.success("Template saved ✓");
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!editingKey) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/settings/email-template/${encodeURIComponent(editingKey)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Reset failed");
      }
      toast.success("Reverted to built-in template");
      const d = getEffectiveTemplate(editingKey, null);
      setSubject(d.subject);
      setBody(d.body);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="rounded-sm border border-[#EBEBEA] bg-white p-6">
      <h2 className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-[#6B6B68]">Email templates</h2>
      <p className="mt-2 font-body text-xs text-[#6B6B68]">
        Customise transactional emails. If not customised here, the app uses its built-in defaults. Variables such as{" "}
        <code className="text-[11px]">{"{{firstName}}"}</code>, <code className="text-[11px]">{"{{orderNumber}}"}</code> may be
        used where supported.
      </p>
      <ul className="mt-4 divide-y divide-[#EBEBEA] border border-[#EBEBEA]">
        {TEMPLATE_KEY_LIST.map((key) => {
          const meta = EMAIL_TEMPLATE_META[key];
          if (!meta) return null;
          return (
            <li key={key} className="flex items-center justify-between gap-3 px-3 py-3">
              <span className="font-body text-sm text-charcoal">{meta.label}</span>
              <button
                type="button"
                onClick={() => openEditor(key)}
                className="shrink-0 font-body text-[11px] font-medium uppercase tracking-wide text-olive underline"
              >
                Edit
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] max-h-[90vh] w-[min(96vw,480px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-[#EBEBEA] bg-white p-6 shadow-lg">
            <Dialog.Title className="font-display text-lg text-charcoal">
              {editingKey && EMAIL_TEMPLATE_META[editingKey]?.label}
            </Dialog.Title>
            <div className="mt-4 space-y-4">
              <div>
                <label className="font-body text-xs text-charcoal">Subject</label>
                <input
                  className="mt-1 w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="font-body text-xs text-charcoal">Body</label>
                <textarea
                  className="mt-1 min-h-[200px] w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-between">
              <button
                type="button"
                disabled={resetting || !editingKey}
                onClick={() => void reset()}
                className="font-body text-[11px] text-dark-grey underline disabled:opacity-50"
              >
                {resetting ? "Resetting…" : "Reset to default"}
              </button>
              <div className="flex gap-2">
                <Dialog.Close asChild>
                  <button type="button" className="border border-[#EBEBEA] px-4 py-2 font-body text-xs uppercase text-charcoal">
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="bg-[#37392d] px-4 py-2 font-body text-xs font-medium uppercase text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
