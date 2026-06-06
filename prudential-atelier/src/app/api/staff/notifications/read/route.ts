import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPortal } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  id: z.string().optional(),
  markAllRead: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const gate = await requireStaffPortal();
  if (!gate.ok) return gate.response;

  const userId = gate.session.user.id!;
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (parsed.data.markAllRead) {
    await prisma.staffNotification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ success: true });
  }

  if (parsed.data.id) {
    await prisma.staffNotification.updateMany({
      where: { id: parsed.data.id, userId },
      data: { isRead: true },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Provide id or markAllRead" }, { status: 400 });
}
