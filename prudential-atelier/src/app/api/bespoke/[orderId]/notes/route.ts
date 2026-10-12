import { NextRequest, NextResponse } from "next/server";
import { requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import { addNote, listCommissionNotes, parseNoteInput } from "@/lib/atelier/commission-notes";

type Params = { params: Promise<{ orderId: string }> };

/** BD2: the commission's notes, and those on the consultation it came from. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const gate = await requireBespokeAccess("read", { orderId });
  if (!gate.ok) return gate.response;
  return NextResponse.json({ items: await listCommissionNotes(orderId) });
}

/** BD2: append a note (or a correction). Never an edit. */
export async function POST(req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const gate = await requireBespokeAccess("manage", { orderId });
  if (!gate.ok) return gate.response;

  const parsed = parseNoteInput(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const u = gate.session.user;
  const result = await addNote({ orderId }, parsed.note, { id: u.id!, name: u.name ?? null, email: u.email ?? null });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ item: result.note }, { status: 201 });
}
