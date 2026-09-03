import type { AdminNotificationType } from "@prisma/client";
import { createNotification } from "@/lib/notifications";

/** Alias — targeting is stored on the row via `targetPermissions`, not `targetRoles`. */
export async function createAdminNotification(params: {
  type: AdminNotificationType;
  title: string;
  message: string;
  link?: string;
  entityId?: string;
  targetPermissions?: string[];
}): Promise<void> {
  await createNotification(params);
}
