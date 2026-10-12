"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { NOTE_SECTION_LABELS, type NoteRow, type NoteSection } from "@/lib/atelier/commission-notes-shared";
import { cn, formatDate } from "@/lib/utils";

/**
 * Slice BD2 — "Add note", never "Edit". Each note keeps its author and time;
 * a correction is a new note that says what it corrects, and the original stays
 * on the page, struck through, so nobody can say the brief silently changed.
 */
export function NotesStream({
  endpoint,
  sections,
  defaultSection,
  canAdd,
  title = "Notes",
  intro,
}: {
  /** GET lists, POST appends. */
  endpoint: string;
  /** Sections this page writes to (all of them are shown). */
  sections: NoteSection[];
  defaultSection: NoteSection;
  canAdd: boolean;
  title?: string;
  intro?: string;
}) {
  const [notes, setNotes] = useState<NoteRow[] | null>(null);
  const [section, setSection] = useState<NoteSection>(defaultSection);
  const [body, setBody] = useState("");
  const [correcting, setCorrecting] = useState<NoteRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(endpoint);
    if (res.ok) setNotes(((await res.json()) as { items: NoteRow[] }).items);
    else setNotes([]);
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!body.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, body, supersedesId: correcting?.id ?? null }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Could not add the note");
      setBody("");
      setCorrecting(null);
      toast.success(correcting ? "Correction added" : "Note added — the team has been told");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the note");
    } finally {
      setSaving(false);
    }
  }

  const byId = new Map((notes ?? []).map((n) => [n.id, n]));

  return (
    <section className="card-surface p-6">
      <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-text-light">{title}</h2>
      {intro ? <p className="mt-1 font-sans text-xs text-text-mid">{intro}</p> : null}

      {notes === null ? (
        <p className="mt-3 font-sans text-sm text-text-light">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="mt-3 font-sans text-sm text-text-mid">No notes yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {notes.map((n) => {
            const corrected = Boolean(n.correctedById);
            const corrects = n.supersedesId ? byId.get(n.supersedesId) : null;
            return (
              <li key={n.id} className={cn("border-l-2 pl-3", corrected ? "border-sand opacity-70" : "border-lightbr")}>
                <p className="font-sans text-11px uppercase tracking-wide text-text-light">
                  {n.sectionLabel} · {n.authorName} · {formatDate(n.createdAt, "d MMM yyyy, HH:mm")}
                  {n.anchor === "consultation" ? " · on the consultation" : ""}
                </p>
                {corrects ? (
                  <p className="mt-0.5 font-sans text-xs text-text-mid">
                    Corrects the note of {formatDate(corrects.createdAt, "d MMM, HH:mm")}
                  </p>
                ) : null}
                <p className={cn("mt-1 whitespace-pre-wrap font-sans text-sm text-ink", corrected && "line-through")}>
                  {n.body}
                </p>
                {corrected ? (
                  <p className="mt-0.5 font-sans text-xs text-text-mid">Corrected by a later note.</p>
                ) : canAdd ? (
                  <button
                    type="button"
                    className="mt-1 font-sans text-xs text-nut underline"
                    onClick={() => {
                      setCorrecting(n);
                      setSection(n.section);
                      setBody(n.body);
                    }}
                  >
                    Correct this note
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {canAdd ? (
        <div className="mt-5 space-y-2 border-t border-sand pt-4">
          {correcting ? (
            <p className="font-sans text-xs text-text-mid">
              Correcting the note of {formatDate(correcting.createdAt, "d MMM, HH:mm")}. Both will stay visible.{" "}
              <button type="button" className="underline" onClick={() => { setCorrecting(null); setBody(""); }}>
                Cancel
              </button>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as NoteSection)}
              disabled={Boolean(correcting)}
              aria-label="Which part of the file"
              className="rounded border border-sand bg-bg-card px-2 py-2 font-sans text-sm"
            >
              {sections.map((s) => (
                <option key={s} value={s}>
                  {NOTE_SECTION_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="A call summary, a change she asked for, what the workroom needs to know…"
            className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
          />
          <Button size="sm" loading={saving} disabled={!body.trim()} onClick={() => void save()}>
            {correcting ? "Add correction" : "Add note"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
