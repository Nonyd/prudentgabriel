/**
 * Slice BD2 — the parts of a note that the browser needs too (no database).
 * The writer is commission-notes.ts.
 */

export const NOTE_SECTIONS = [
  "consultation",
  "about_dress",
  "brief",
  "beads",
  "fabric",
  "fitting",
  "delivery",
] as const;
export type NoteSection = (typeof NOTE_SECTIONS)[number];

export const NOTE_SECTION_LABELS: Record<NoteSection, string> = {
  consultation: "Consultation",
  about_dress: "About the dress",
  brief: "Production brief",
  beads: "Beads",
  fabric: "Fabric",
  fitting: "Fitting and alteration",
  delivery: "Delivery",
};

export const NOTE_MAX = 4000;

export function isNoteSection(v: unknown): v is NoteSection {
  return typeof v === "string" && (NOTE_SECTIONS as readonly string[]).includes(v);
}

export type NoteInput = { section: NoteSection; body: string; supersedesId: string | null };

/** Validate a POST body. Pure. */
export function parseNoteInput(raw: unknown): { ok: true; note: NoteInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Send a section and a note." };
  const r = raw as { section?: unknown; body?: unknown; supersedesId?: unknown };
  if (!isNoteSection(r.section)) return { ok: false, error: "Unknown section." };
  const body = typeof r.body === "string" ? r.body.trim() : "";
  if (!body) return { ok: false, error: "The note is empty." };
  if (body.length > NOTE_MAX) return { ok: false, error: `Keep a note under ${NOTE_MAX} characters.` };
  const supersedesId = typeof r.supersedesId === "string" && r.supersedesId ? r.supersedesId : null;
  return { ok: true, note: { section: r.section, body, supersedesId } };
}

export type Anchor = { orderId: string } | { consultationId: string };

export type NoteRow = {
  id: string;
  section: NoteSection;
  sectionLabel: string;
  body: string;
  authorName: string;
  createdAt: string;
  /** This note corrects that one. */
  supersedesId: string | null;
  /** A later note corrects this one; it stays visible, marked. */
  correctedById: string | null;
  anchor: "consultation" | "commission";
};
