import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  id: z.string().optional(),
  markAllRead: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (parsed.data.markAllRead) {
    await prisma.adminNotification.updateMany({ where: { isRead: false }, data: { isRead: true } });
    return NextResponse.json({ success: true });
  }

  if (parsed.data.id) {
    await prisma.adminNotification.update({
      where: { id: parsed.data.id },
      data: { isRead: true },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Provide id or markAllRead" }, { status: 400 });
}
