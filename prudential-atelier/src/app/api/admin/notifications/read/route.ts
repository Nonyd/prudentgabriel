import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPortalApi, resolveSessionAccess } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { adminNotificationVisibleWhere } from "@/lib/admin-notification-access";

const bodySchema = z.object({
  id: z.string().optional(),
  markAllRead: z.boolean().optional(),
  acknowledge: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const gate = await requireAdminPortalApi();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, actor } = await resolveSessionAccess(gate.session);

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (parsed.data.acknowledge && parsed.data.id) {
    const existing = await prisma.adminNotification.findFirst({
      where: { id: parsed.data.id, ...adminNotificationVisibleWhere(role, actor) },
      select: { id: true, acknowledgedAt: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!existing.acknowledgedAt) {
      await prisma.adminNotification.update({
        where: { id: existing.id },
        data: { acknowledgedAt: new Date(), acknowledgedById: userId },
      });
    }
    await prisma.adminNotificationRead.upsert({
      where: { userId_notificationId: { userId, notificationId: existing.id } },
      create: { userId, notificationId: existing.id },
      update: {},
    });
    return NextResponse.json({ success: true });
  }

  if (parsed.data.markAllRead) {
    const unread = await prisma.adminNotification.findMany({
      where: {
        AND: [
          adminNotificationVisibleWhere(role, actor),
          { acknowledgedAt: null },
          { reads: { none: { userId } } },
        ],
      },
      select: { id: true },
    });
    if (unread.length) {
      await prisma.adminNotificationRead.createMany({
        data: unread.map((n) => ({ userId, notificationId: n.id })),
        skipDuplicates: true,
      });
    }
    return NextResponse.json({ success: true });
  }

  if (parsed.data.id) {
    const visible = await prisma.adminNotification.findFirst({
      where: { id: parsed.data.id, ...adminNotificationVisibleWhere(role, actor) },
      select: { id: true },
    });
    if (!visible) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.adminNotificationRead.upsert({
      where: { userId_notificationId: { userId, notificationId: visible.id } },
      create: { userId, notificationId: visible.id },
      update: {},
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Provide id, markAllRead, or acknowledge" }, { status: 400 });
}
