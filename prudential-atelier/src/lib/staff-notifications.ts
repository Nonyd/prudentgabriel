import type { StaffNotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function createStaffNotification(params: {
  userId: string;
  type: StaffNotificationType;
  title: string;
  message: string;
  link?: string;
  entityId?: string;
}): Promise<void> {
  await prisma.staffNotification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link ?? null,
      entityId: params.entityId ?? null,
    },
  });
}

export function notifyStaffJobAssigned(params: {
  userId: string;
  orderId: string;
  orderRef: string;
  role: string;
  outfitDescription?: string | null;
  assignmentId: string;
}): void {
  void (async () => {
    const outfit = params.outfitDescription?.trim();
    const message = outfit
      ? `${params.orderRef} — ${outfit}. You are assigned as ${params.role}.`
      : `${params.orderRef} — You are assigned as ${params.role}.`;

    await createStaffNotification({
      userId: params.userId,
      type: "JOB_ASSIGNED",
      title: "New job assignment",
      message,
      link: `/staff/orders/${params.orderId}`,
      entityId: params.assignmentId,
    });
  })().catch(() => {});
}

export function notifyStaffOrderUpdate(params: {
  userId: string;
  orderId: string;
  orderRef: string;
  title: string;
  message: string;
}): void {
  void createStaffNotification({
    userId: params.userId,
    type: "ORDER_UPDATE",
    title: params.title,
    message: params.message,
    link: `/staff/orders/${params.orderId}`,
    entityId: params.orderId,
  }).catch(() => {});
}
