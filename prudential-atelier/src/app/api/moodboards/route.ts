import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BESPOKE_ROLES, requireRoles } from "@/lib/api-auth";
import { logActivity, logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const gate = await requireRoles(BESPOKE_ROLES);
  if (!gate.ok) return gate.response;

  const clientId = req.nextUrl.searchParams.get("clientId")?.trim();
  if (!clientId) {
    return NextResponse.json({ error: "clientId query parameter is required" }, { status: 400 });
  }

  try {
    const client = await prisma.clientProfile.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const items = await prisma.moodboard.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "MOODBOARD_LIST",
      message: e instanceof Error ? e.message : "Failed to list moodboards",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireRoles(BESPOKE_ROLES);
  if (!gate.ok) return gate.response;

  let body: {
    clientId?: string;
    title?: string;
    images?: string[];
    notes?: string;
    bespokeOrderId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clientId = body.clientId?.trim();
  const title = body.title?.trim();
  if (!clientId || !title) {
    return NextResponse.json({ error: "clientId and title are required" }, { status: 400 });
  }

  const images = Array.isArray(body.images)
    ? body.images.filter((url): url is string => typeof url === "string" && url.trim().length > 0)
    : [];

  try {
    const client = await prisma.clientProfile.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const item = await prisma.moodboard.create({
      data: {
        clientId,
        title,
        images,
        notes: body.notes?.trim() || null,
        bespokeOrderId: body.bespokeOrderId?.trim() || null,
      },
    });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "CREATE",
      module: "clients",
      description: `Created moodboard "${title}" for client ${clientId}`,
      recordId: item.id,
      recordType: "Moodboard",
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "MOODBOARD_CREATE",
      message: e instanceof Error ? e.message : "Failed to create moodboard",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
