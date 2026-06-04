import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BESPOKE_ROLES, requireRoles } from "@/lib/api-auth";
import { logActivity, logError } from "@/lib/logger";

type Params = { params: Promise<{ clientId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireRoles(BESPOKE_ROLES);
  if (!gate.ok) return gate.response;

  const { clientId } = await params;

  let body: { note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const note = body.note?.trim();
  if (!note) {
    return NextResponse.json({ error: "Note text is required" }, { status: 400 });
  }

  try {
    const client = await prisma.clientProfile.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const addedBy = gate.session.user.id;
    if (!addedBy) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const item = await prisma.clientNote.create({
      data: {
        clientId,
        note,
        addedBy,
        addedByName: gate.session.user.name ?? gate.session.user.email ?? undefined,
      },
    });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "CREATE",
      module: "clients",
      description: `Added note on client ${clientId}`,
      recordId: item.id,
      recordType: "ClientNote",
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "CLIENT_NOTE",
      message: e instanceof Error ? e.message : "Failed to add client note",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
