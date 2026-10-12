import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fileWorkLog, parseWorkLogInput, workday } from "@/lib/atelier/work-log";

/**
 * BD7: the staff member's own end-of-day entries. Like the rest of the staff
 * portal, only her own assignments — the commission is checked against her
 * staff profile on every write.
 */
async function staffProfileId() {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const staff = await prisma.staffProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!staff) return { ok: false as const, response: NextResponse.json({ error: "Staff profile not found" }, { status: 404 }) };
  return { ok: true as const, id: staff.id };
}

export async function GET() {
  const me = await staffProfileId();
  if (!me.ok) return me.response;
  return NextResponse.json(await workday(me.id));
}

export async function POST(req: NextRequest) {
  const me = await staffProfileId();
  if (!me.ok) return me.response;
  const parsed = parseWorkLogInput(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const result = await fileWorkLog(me.id, parsed.input);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(await workday(me.id));
}
