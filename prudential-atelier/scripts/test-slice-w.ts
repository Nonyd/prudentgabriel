/**
 * Slice W: per-user admin reads, oversell type, permission targeting, dead enums.
 *
 *   pnpm test:slice-w
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { createNotification } from "../src/lib/notifications";
import {
  ADMIN_NOTIFICATION_TARGETS,
  actorSeesTargets,
  adminNotificationUnreadWhere,
  targetsForAdminNotificationType,
} from "../src/lib/admin-notification-access";
import { listTodayOversellNotifications, oversellReportHtml } from "../src/lib/oversell-report";
import { resolveAdminAlertEmail } from "../src/lib/admin-alert-email";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const stamp = `slice-w-${Date.now()}`;
const ids = { userIds: [] as string[], notificationIds: [] as string[] };

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "../src");

async function cleanup() {
  if (ids.notificationIds.length) {
    await prisma.adminNotificationRead.deleteMany({
      where: { notificationId: { in: ids.notificationIds } },
    });
    await prisma.adminNotification.deleteMany({ where: { id: { in: ids.notificationIds } } });
  }
  if (ids.userIds.length) {
    await prisma.userPermission.deleteMany({ where: { userId: { in: ids.userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.userIds } } });
  }
}

async function testMarkAllReadIsPerUser() {
  const a = await prisma.user.create({
    data: { email: `${stamp}-a@example.test`, name: "Reader A", role: Role.FINANCE_MANAGER },
  });
  const b = await prisma.user.create({
    data: { email: `${stamp}-b@example.test`, name: "Reader B", role: Role.FINANCE_MANAGER },
  });
  ids.userIds.push(a.id, b.id);

  await createNotification({
    type: "BANK_TRANSFER_RECEIPT",
    title: `${stamp} bank receipt`,
    message: "test",
    entityId: stamp,
  });
  const row = await prisma.adminNotification.findFirstOrThrow({
    where: { entityId: stamp, type: "BANK_TRANSFER_RECEIPT" },
    select: { id: true },
  });
  ids.notificationIds.push(row.id);

  await prisma.adminNotificationRead.create({
    data: { userId: a.id, notificationId: row.id },
  });

  const unreadA = await prisma.adminNotification.count({
    where: { id: row.id, ...adminNotificationUnreadWhere(a.id, Role.FINANCE_MANAGER) },
  });
  const unreadB = await prisma.adminNotification.count({
    where: { id: row.id, ...adminNotificationUnreadWhere(b.id, Role.FINANCE_MANAGER) },
  });

  assert(unreadA === 0, `user A mark-read should clear their unread, got ${unreadA}`);
  assert(unreadB === 1, `user B must still see unread after A marked read, got ${unreadB}`);
}

async function testOversellTypeAndDailyReport() {
  await createNotification({
    type: "RTW_OVERSELL",
    title: "RTW oversell — refund required",
    message: `${stamp} paid but stock was gone`,
    entityId: `${stamp}-oversell`,
  });
  const row = await prisma.adminNotification.findFirstOrThrow({
    where: { entityId: `${stamp}-oversell` },
  });
  ids.notificationIds.push(row.id);

  assert(row.type === "RTW_OVERSELL", `oversell type should be RTW_OVERSELL, got ${row.type}`);
  const targets = targetsForAdminNotificationType("RTW_OVERSELL");
  assert(targets.includes("payments") && targets.includes("shop.orders"), "oversell targets payments and shop.orders");

  const from = new Date(Date.now() - 60_000);
  const to = new Date(Date.now() + 60_000);
  const notices = await listTodayOversellNotifications(from, to);
  assert(
    notices.some((n) => n.id === row.id),
    "oversell notice must appear in today's oversell report query",
  );
  const html = oversellReportHtml([], notices.filter((n) => n.id === row.id));
  assert(html.includes("RTW oversell"), `daily report html should include oversell, got ${html}`);
}

async function testPaymentsTargeting() {
  const targets = ADMIN_NOTIFICATION_TARGETS.BANK_TRANSFER_RECEIPT;
  assert(targets.includes("payments"), "bank transfer is a payments notice");
  assert(
    actorSeesTargets("FINANCE_MANAGER", targets),
    "Finance Manager holds payments and must see the notice",
  );
  assert(
    !actorSeesTargets("CONTENT_MANAGER", targets),
    "Content Manager must not see a payments notice",
  );
  assert(
    actorSeesTargets("CONTENT_MANAGER", targets, { grants: ["payments"], revokes: [] }),
    "A per-user GRANT of payments must receive the notice",
  );
  assert(
    !actorSeesTargets("RTW_MANAGER", targets),
    "RTW Manager does not hold payments — bank receipts stay with Finance",
  );

  const content = await prisma.user.create({
    data: { email: `${stamp}-cms@example.test`, name: "CMS", role: Role.CONTENT_MANAGER },
  });
  const finance = await prisma.user.create({
    data: { email: `${stamp}-fin@example.test`, name: "Fin", role: Role.FINANCE_MANAGER },
  });
  ids.userIds.push(content.id, finance.id);

  await createNotification({
    type: "BANK_TRANSFER_RECEIPT",
    title: `${stamp} payments-only`,
    message: "payments desk",
    entityId: `${stamp}-pay`,
  });
  const row = await prisma.adminNotification.findFirstOrThrow({
    where: { entityId: `${stamp}-pay` },
  });
  ids.notificationIds.push(row.id);

  const cmsCount = await prisma.adminNotification.count({
    where: { id: row.id, ...adminNotificationUnreadWhere(content.id, Role.CONTENT_MANAGER) },
  });
  const finCount = await prisma.adminNotification.count({
    where: { id: row.id, ...adminNotificationUnreadWhere(finance.id, Role.FINANCE_MANAGER) },
  });
  assert(cmsCount === 0, "Content Manager unread count for payments notice must be 0");
  assert(finCount === 1, "Finance Manager unread count for payments notice must be 1");
}

async function testRemovedEnumHasNoUiBranch() {
  const files = [
    "components/admin/NotificationsPageClient.tsx",
    "components/admin/NotificationBell.tsx",
    "components/staff/StaffNotificationBell.tsx",
    "lib/staff-notifications.ts",
  ];
  const banned = [
    "COUPON_EXPIRING",
    "STAGE_CHANGES_REQUESTED",
    "ALTERATION_UPDATE",
    "STAGE_REASSIGNED",
    "TASK_ASSIGNED",
    "JOB_ASSIGNED",
    "notifyStaffJobAssigned",
  ];
  for (const rel of files) {
    const text = readFileSync(join(srcRoot, rel), "utf8");
    for (const token of banned) {
      assert(!text.includes(token), `${rel} still mentions ${token}`);
    }
  }
}

async function testHelloIsNotAFallback() {
  const to = await resolveAdminAlertEmail(async () => "hello@prudentgabriel.com");
  assert(to === null, `hello@ must not be used as a fallback, got ${to}`);
}

async function main() {
  try {
    await testMarkAllReadIsPerUser();
    await testOversellTypeAndDailyReport();
    await testPaymentsTargeting();
    await testRemovedEnumHasNoUiBranch();
    await testHelloIsNotAFallback();
    console.log("test-slice-w: ok");
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
