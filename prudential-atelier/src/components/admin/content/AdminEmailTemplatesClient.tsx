"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { EmailTemplateKey } from "@/lib/admin-email-catalog";
import type { StoredEmailTemplate } from "@/lib/admin-email-template-store";

type Props = {
  templates: Record<EmailTemplateKey, StoredEmailTemplate>;
  adminEmail: string;
};

const GROUPS = [
  { id: "client", label: "CLIENT EMAILS" },
  { id: "admin", label: "ADMIN EMAILS" },
  { id: "staff", label: "STAFF EMAILS" },
] as const;

export function AdminEmailTemplatesClient({ templates, adminEmail }: Props) {
  const keys = useMemo(
    () => Object.values(templates).sort((a, b) => a.label.localeCompare(b.label)),
    [templates],
  );

  const [selectedKey, setSelectedKey] = useState<EmailTemplateKey | null>(keys[0]?.key ?? null);
  const selected = selectedKey ? templates[selectedKey] : null;

  const [subject, setSubject] = useState(keys[0]?.subject ?? "");
  const [heading, setHeading] = useState(keys[0]?.heading ?? "");
  const [body1, setBody1] = useState(keys[0]?.body_1 ?? "");
  const [body2, setBody2] = useState(keys[0]?.body_2 ?? "");
  const [ctaLabel, setCtaLabel] = useState(keys[0]?.cta_label ?? "");
  const [ctaLink, setCtaLink] = useState(keys[0]?.cta_link ?? "");
  const [footerNote, setFooterNote] = useState(keys[0]?.footer_note ?? "");
  const [testTo, setTestTo] = useState(adminEmail);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  function loadTemplate(key: EmailTemplateKey) {
    const t = templates[key];
    if (!t) return;
    setSelectedKey(key);
    setSubject(t.subject);
    setHeading(t.heading);
    setBody1(t.body_1);
    setBody2(t.body_2);
    setCtaLabel(t.cta_label);
    setCtaLink(t.cta_link);
    setFooterNote(t.footer_note);
  }

  useEffect(() => {
    if (keys[0] && !selectedKey) loadTemplate(keys[0].key);
  }, [keys, selectedKey]);

  async function save() {
    if (!selectedKey) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/email-templates/${selectedKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          heading,
          body_1: body1,
          body_2: body2,
          cta_label: ctaLabel,
          cta_link: ctaLink,
          footer_note: footerNote,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "Save failed");
      toast.success("Template saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!selectedKey || !testTo) return;
    setTesting(true);
    try {
      const res = await fetch(`/api/admin/email-templates/${selectedKey}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "Send failed");
      toast.success("Test email sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mt-8 flex gap-6">
      <aside className="w-[240px] shrink-0 space-y-6">
        {GROUPS.map((group) => {
          const items = keys.filter((k) => k.group === group.id);
          if (!items.length) return null;
          return (
            <div key={group.id}>
              <p className="font-label text-[10px] uppercase tracking-widest text-gold">{group.label}</p>
              <ul className="mt-2 space-y-0.5">
                {items.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      title={
                        item.lastEdited
                          ? `Last edited ${new Date(item.lastEdited).toLocaleDateString("en-GB")}`
                          : undefined
                      }
                      onClick={() => loadTemplate(item.key)}
                      className={`w-full border-l-2 px-3 py-2 text-left font-body text-xs ${
                        selectedKey === item.key
                          ? "border-choc bg-[rgba(68,41,19,0.08)] text-choc"
                          : "border-transparent text-[#6B6B68] hover:bg-sand/40"
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </aside>

      <div className="min-w-0 flex-1 glass-opaque p-6">
        {selected ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand pb-4">
              <h2 className="font-display text-lg text-ink">{selected.label}</h2>
              {selected.lastEdited ? (
                <p className="text-xs text-[#6B6B68]">
                  Last edited: {new Date(selected.lastEdited).toLocaleDateString("en-GB")}
                </p>
              ) : null}
            </div>

            <div className="mt-6 space-y-4">
              <Field label="Subject line" value={subject} onChange={setSubject} />
              <p className="text-xs text-[#6B6B68]">
                Variables: {"{{firstName}} {{lastName}} {{email}} {{orderRef}} {{outfitName}} {{amount}} {{date}} {{link}}"}
              </p>
              <Field label="Heading" value={heading} onChange={setHeading} />
              <TextArea label="Body paragraph 1" value={body1} onChange={setBody1} />
              <TextArea label="Body paragraph 2 (optional)" value={body2} onChange={setBody2} />
              <Field label="CTA button label" value={ctaLabel} onChange={setCtaLabel} />
              <Field label="CTA button link" value={ctaLink} onChange={setCtaLink} />
              <TextArea label="Footer note (optional)" value={footerNote} onChange={setFooterNote} rows={2} />
            </div>

            <div className="mt-8 border-t border-sand pt-6">
              <p className="font-label text-xs uppercase tracking-widest text-gold">Send test email</p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="block flex-1 text-xs text-[#6B6B68]">
                  To
                  <input
                    type="email"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    className="mt-1 w-full rounded-sm border border-sand px-3 py-2 text-sm text-ink"
                  />
                </label>
                <button
                  type="button"
                  disabled={testing}
                  onClick={() => void sendTest()}
                  className="rounded-sm bg-wine px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {testing ? "Sending…" : "Send test email →"}
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="mt-6 rounded-sm bg-choc px-5 py-2.5 text-sm text-cream disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save template"}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs text-[#6B6B68]">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-sm border border-sand bg-white px-3 py-2 text-sm text-ink"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block text-xs text-[#6B6B68]">
      {label}
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-sm border border-sand bg-white px-3 py-2 text-sm text-ink"
      />
    </label>
  );
}
