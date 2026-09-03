import type { AdminNotificationType, Prisma } from "@prisma/client";
import { permissionSetAllows } from "@/lib/permission-resolve";
import {
  ALL_PERMISSIONS,
  CMS_ADMIN_PERMISSIONS,
  resolveEffectivePermissionSet,
  type AccessActor,
  type AdminPermission,
} from "@/lib/roles";

/** Explicit broadcast — every portal user. Never implied by an empty array. */
export const ADMIN_NOTIFICATION_EVERYONE = "*";

/**
 * W1.1 event → permission targets.
 * A user sees a row if they hold any listed key (including per-user GRANT/REVOKE),
 * or if the list is `["*"]`. Oversell needs both Finance (`payments`) and the RTW
 * desk (`shop.orders`); one key cannot express that OR, so the field is an array.
 */
export const ADMIN_NOTIFICATION_TARGETS: Record<AdminNotificationType, readonly string[]> = {
  NEW_ORDER: ["shop.orders"],
  BANK_TRANSFER_RECEIPT: ["payments"],
  PAYMENT_FAILED: ["shop.orders"],
  RTW_OVERSELL: ["payments", "shop.orders"],
  NEW_BESPOKE: ["bespoke"],
  QUOTE_APPROVED: ["quotations"],
  STAGE_COMPLETED: ["bespoke"],
  PRODUCTION_UNLOCKED: ["bespoke"],
  PRODUCTION_RELOCKED: ["bespoke"],
  STAGE_APPROVAL_RESPONSE: ["bespoke"],
  NEW_CONSULTATION: ["consultations"],
  CONSULTATION_COMPLETED: ["consultations"],
  CONSULTATION_BOOKED_PRUDENT: ["consultations"],
  QUOTE_AWAITING: ["quotations"],
  REVIEW_PENDING: CMS_ADMIN_PERMISSIONS,
  TESTIMONIAL_SUBMITTED: CMS_ADMIN_PERMISSIONS,
  LOW_STOCK: ["shop.products"],
  NEW_CUSTOMER: ["clients", "clients.view"],
  CONTACT_FORM: CMS_ADMIN_PERMISSIONS,
  JOB_APPLICATION: ["staff"],
  EMAIL_DEAD: [ADMIN_NOTIFICATION_EVERYONE],
  EMAIL_PROVIDER_AUTH: [ADMIN_NOTIFICATION_EVERYONE],
};

export function targetsForAdminNotificationType(type: AdminNotificationType): string[] {
  return [...ADMIN_NOTIFICATION_TARGETS[type]];
}

export function heldAdminPermissionKeys(role: string, actor?: AccessActor): string[] | "*" {
  const set = resolveEffectivePermissionSet(role, actor);
  if (set === "*") return "*";
  return ALL_PERMISSIONS.filter((p) => permissionSetAllows(set, p));
}

export function adminNotificationVisibleWhere(
  role: string,
  actor?: AccessActor,
): Prisma.AdminNotificationWhereInput {
  const keys = heldAdminPermissionKeys(role, actor);
  if (keys === "*") return {};
  if (keys.length === 0) {
    return { targetPermissions: { has: ADMIN_NOTIFICATION_EVERYONE } };
  }
  return {
    OR: [
      { targetPermissions: { has: ADMIN_NOTIFICATION_EVERYONE } },
      { targetPermissions: { hasSome: keys } },
    ],
  };
}

export function adminNotificationUnreadWhere(
  userId: string,
  role: string,
  actor?: AccessActor,
): Prisma.AdminNotificationWhereInput {
  return {
    AND: [
      adminNotificationVisibleWhere(role, actor),
      { acknowledgedAt: null },
      { reads: { none: { userId } } },
    ],
  };
}

export type AdminNotificationRow = {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  link: string | null;
  entityId: string | null;
  createdAt: Date;
  isRead: boolean;
  acknowledgedAt: Date | null;
  acknowledgedByName: string | null;
};

export function serializeAdminNotification(row: {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  link: string | null;
  entityId: string | null;
  createdAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedBy: { name: string | null; email: string } | null;
  reads: { userId: string }[];
}): AdminNotificationRow {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    link: row.link,
    entityId: row.entityId,
    createdAt: row.createdAt,
    isRead: row.reads.length > 0,
    acknowledgedAt: row.acknowledgedAt,
    acknowledgedByName: row.acknowledgedBy?.name?.trim() || row.acknowledgedBy?.email || null,
  };
}

export const adminNotificationListInclude = (userId: string) =>
  ({
    reads: { where: { userId }, select: { userId: true } },
    acknowledgedBy: { select: { name: true, email: true } },
  }) satisfies Prisma.AdminNotificationInclude;

/** For tests: would this actor see a notification targeted at these keys? */
export function actorSeesTargets(
  role: string,
  targetPermissions: readonly string[],
  actor?: AccessActor,
): boolean {
  if (targetPermissions.includes(ADMIN_NOTIFICATION_EVERYONE)) return true;
  const keys = heldAdminPermissionKeys(role, actor);
  if (keys === "*") return true;
  return targetPermissions.some((t) => keys.includes(t as AdminPermission) || keys.includes(t));
}
