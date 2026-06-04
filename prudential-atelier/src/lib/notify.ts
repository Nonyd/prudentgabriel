import { AdminNotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ROLE_TO_SYSTEM: Record<string, string[]> = {
  consultation_booking: ["CONSULTATION_MANAGER", "ADMIN", "SUPER_ADMIN"],
  bank_transfer: ["FINANCE_MANAGER", "ADMIN", "SUPER_ADMIN"],
  stage_advanced: ["BESPOKE_MANAGER", "ADMIN", "SUPER_ADMIN"],
  new_client: ["ADMIN", "SUPER_ADMIN"],
  low_stock: ["RTW_MANAGER", "ADMIN", "SUPER_ADMIN"],
  late_staff: ["HR_MANAGER", "ADMIN", "SUPER_ADMIN"],
  quote_approved: ["BESPOKE_MANAGER", "FINANCE_MANAGER", "ADMIN", "SUPER_ADMIN"],
};

export async function createAdminNotification(params: {
  type: AdminNotificationType;
  title: string;
  message: string;
  link?: string;
  entityId?: string;
  targetRoles?: string[];
}): Promise<void> {
  await prisma.adminNotification.create({
    data: {
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link ?? null,
      entityId: params.entityId ?? null,
    },
  });

  void params.targetRoles;
  void ROLE_TO_SYSTEM;
}
