import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BESPOKE_ROLES, requireRoles } from "@/lib/api-auth";

type Params = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireRoles(BESPOKE_ROLES);
  if (!gate.ok) return gate.response;

  const { orderId } = await params;
  let body: { staffProfileId?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.staffProfileId || !body.role) {
    return NextResponse.json({ error: "staffProfileId and role are required" }, { status: 400 });
  }

  const staff = await prisma.staffProfile.findUnique({ where: { id: body.staffProfileId } });
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const assignment = await prisma.orderAssignment.create({
    data: {
      orderId,
      staffProfileId: body.staffProfileId,
      role: body.role,
    },
    include: {
      staffProfile: { include: { user: { select: { name: true, email: true } } } },
    },
  });

  return NextResponse.json({ item: assignment }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const gate = await requireRoles(BESPOKE_ROLES);
  if (!gate.ok) return gate.response;

  const { orderId } = await params;
  const { searchParams } = new URL(req.url);
  const assignmentId = searchParams.get("assignmentId");
  if (!assignmentId) {
    return NextResponse.json({ error: "assignmentId required" }, { status: 400 });
  }

  await prisma.orderAssignment.deleteMany({
    where: { id: assignmentId, orderId },
  });

  return NextResponse.json({ success: true });
}
