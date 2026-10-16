"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

type Loaded = { text: string; isDefault: boolean; subject: string; maxChars: number };

/** Edit the founder's letter text, with the real email rendered beside it. */
export function FounderNoteEditor() {
  const [data, setData] = useState<Loaded | null>(null);
  const [text, setText] = useState("");
  const [html, setHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewTimer = useRef<number | null>(null);

  const preview = useCallback(async (value: string) => {
    const res = await fetch("/api/admin/founder-note", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: value, preview: true }),
    });
    const j = (await res.json().catch(() => ({}))) as { html?: string };
    if (j.html) setHtml(j.html);
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/founder-note");
      if (!res.ok) {
        setError("Only a Super Admin can edit the founder's note.");
        return;
      }
      const j = (await res.json()) as Loaded;
      setData(j);
      setText(j.text);
      void preview(j.text);
    })();
  }, [preview]);

  function onChange(value: string) {
    setText(value);
    setError(null);
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => void preview(value), 500);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/founder-note", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Could not save");
      toast.success("Saved. New clients receive this letter from now on.");
      setData((d) => (d ? { ...d, isDefault: false } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (error && !data) return <p className="mt-6 font-body text-sm text-error">{error}</p>;
  if (!data) return <p className="mt-6 font-body text-sm text-text-mid">Loading…</p>;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="glass-1 border border-sand p-5">
        <p className="font-body text-xs uppercase tracking-[0.12em] text-text-mid">Subject</p>
        <p className="mt-1 font-body text-sm text-ink">{data.subject}</p>

        <label htmlFor="founder-note" className="mt-5 block font-body text-xs uppercase tracking-[0.12em] text-text-mid">
          The letter
        </label>
        <p className="mt-1 font-body text-xs text-text-mid">
          It opens with “Dear [her first name],” and closes with the signature, so write only the middle. Leave a blank
          line between paragraphs. Type {"{{firstName}}"} to use her first name inside the text.
        </p>
        <textarea
          id="founder-note"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          maxLength={data.maxChars}
          rows={18}
          aria-invalid={error ? true : undefined}
          className="mt-3 w-full border border-input-border bg-input-bg px-4 py-3 font-body text-sm leading-7 text-ink"
        />
        <div className="mt-1 flex justify-between font-body text-xs text-text-light">
          <span>{data.isDefault ? "Showing the house's suggested letter." : "Your saved letter."}</span>
          <span>
            {text.length.toLocaleString()} / {data.maxChars.toLocaleString()}
          </span>
        </div>
        {error ? <p className="mt-2 font-body text-sm text-error">{error}</p> : null}
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="mt-5 h-10 w-full bg-choc font-body text-11px font-medium uppercase tracking-[0.12em] text-cream disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save the letter"}
        </button>
      </div>

      <div className="glass-1 border border-sand p-3">
        <p className="px-2 pb-2 font-body text-xs uppercase tracking-[0.12em] text-text-mid">
          Preview (as Adaeze would see it)
        </p>
        {/* Rendered email, sandboxed: no scripts, no access to the admin page. */}
        <iframe title="Founder's note preview" sandbox="" srcDoc={html} className="h-[760px] w-full bg-white" />
      </div>
    </div>
  );
}
