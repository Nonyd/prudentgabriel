import { NextRequest, NextResponse } from "next/server";
import { requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import { addNote, listConsultationNotes, parseNoteInput } from "@/lib/atelier/commission-notes";

type Params = { params: Promise<{ id: string }> };

/** BD2: notes added after the session. The session record itself is never rewritten. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const gate = await requireBespokeAccess("manage", { key: "consultations" });
  if (!gate.ok) return gate.response;
  return NextResponse.json({ items: await listConsultationNotes(id) });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const gate = await requireBespokeAccess("manage", { key: "consultations" });
  if (!gate.ok) return gate.response;

  const parsed = parseNoteInput(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const u = gate.session.user;
  const result = await addNote({ consultationId: id }, parsed.note, { id: u.id!, name: u.name ?? null, email: u.email ?? null });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ item: result.note }, { status: 201 });
}
