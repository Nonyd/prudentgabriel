import type { StaffNotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendStageAssignmentEmail } from "@/lib/email";

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

export function notifyStaffStageAssigned(params: {
  userId: string;
  staffEmail: string;
  staffName: string;
  orderId: string;
  orderRef: string;
  stageName: string;
  outfitName: string;
  deliveryDate?: string;
  assignmentId: string;
}): void {
  void (async () => {
    await createStaffNotification({
      userId: params.userId,
      type: "STAGE_ASSIGNED",
      title: "New assignment",
      message: `You've been assigned to ${params.stageName} on order ${params.orderRef}`,
      link: `/staff/orders/${params.orderId}`,
      entityId: params.assignmentId,
    });

    const firstName = params.staffName.split(" ")[0] ?? "there";
    void sendStageAssignmentEmail({
      to: params.staffEmail,
      firstName,
      stageName: params.stageName,
      orderRef: params.orderRef,
      outfitName: params.outfitName,
      deliveryDate: params.deliveryDate,
    }).catch(() => {});
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
