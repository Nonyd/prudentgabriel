import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { isBirthdayToday, lagosYear } from "@/lib/birthday";
import { awardBirthdayPoints } from "@/lib/points";
import { sendUsingCatalog } from "@/lib/catalog-email";
import { EMAIL_TEMPLATE_KEYS } from "@/lib/admin-email-catalog";
import { createClientNotification } from "@/lib/customer-notifications";
import { createStaffNotification } from "@/lib/staff-notifications";

/**
 * Once a day, morning in Lagos: everyone whose birthday is today gets a wish.
 * Clients get the client letter, their birthday Prudent Points and an in-app
 * note; staff and admins get the team letter. Each person is celebrated once a
 * year (`User.birthdayWishedYear`), however often the job runs.
 */
export async function run(ctx: CronJobContext): Promise<JobResult> {
  const now = ctx.now;
  const year = lagosYear(now);
  const appUrl = getPublicAppUrl();

  // 29 February birthdays are kept in February too, and celebrated on the 28th in other years.
  const watMonth = new Date(now.getTime() + 60 * 60 * 1000).getUTCMonth() + 1;
  const candidates = await prisma.user.findMany({
    where: {
      isActive: true,
      birthdayDay: { not: null },
      birthdayMonth: watMonth,
      OR: [{ birthdayWishedYear: null }, { birthdayWishedYear: { lt: year } }],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isStaff: true,
      birthdayDay: true,
      birthdayMonth: true,
      clientProfile: { select: { id: true } },
    },
    take: ctx.batchLimit,
  });

  let processed = 0;
  let failed = 0;
  for (const user of candidates) {
    if (ctx.isBudgetExhausted()) return { processed, failed, hasMore: true };
    if (!user.birthdayDay || !user.birthdayMonth) continue;
    if (!isBirthdayToday({ day: user.birthdayDay, month: user.birthdayMonth }, now)) continue;

    // Claim the year first so two runs never send twice.
    const claimed = await prisma.user.updateMany({
      where: { id: user.id, OR: [{ birthdayWishedYear: null }, { birthdayWishedYear: { lt: year } }] },
      data: { birthdayWishedYear: year },
    });
    if (claimed.count !== 1) continue;

    const firstName = user.name?.trim().split(/\s+/)[0] || "there";
    const team = user.isStaff || user.role !== "CUSTOMER";
    try {
      if (team) {
        await sendUsingCatalog({
          key: EMAIL_TEMPLATE_KEYS.TEAM_BIRTHDAY_WISH,
          to: user.email,
          vars: { firstName },
          outboxTemplate: "team-birthday-wish",
          idempotencyKey: `birthday:${user.id}:${year}`,
          relatedType: "User",
          relatedId: user.id,
        });
        if (user.isStaff) {
          await createStaffNotification({
            userId: user.id,
            type: "BIRTHDAY",
            title: `Happy birthday, ${firstName}!`,
            message: "Wishing you a wonderful day from everyone at Prudent Gabriel.",
          });
        }
      } else {
        const points = user.clientProfile ? await awardBirthdayPoints(user.id, year) : 0;
        const pointsLine =
          points > 0
            ? `As a small gift from us, we have added ${points.toLocaleString("en-NG")} Prudent Points to your account.`
            : "";
        await sendUsingCatalog({
          key: EMAIL_TEMPLATE_KEYS.BIRTHDAY_WISH,
          to: user.email,
          vars: { firstName, pointsLine, shopLink: `${appUrl}/shop` },
          outboxTemplate: "birthday-wish",
          idempotencyKey: `birthday:${user.id}:${year}`,
          relatedType: "User",
          relatedId: user.id,
        });
        await createClientNotification({
          userId: user.id,
          type: "BIRTHDAY",
          title: `Happy birthday, ${firstName}!`,
          message:
            points > 0
              ? `Everyone at Prudent Gabriel is celebrating with you. ${points.toLocaleString("en-NG")} Prudent Points are waiting in your account.`
              : "Everyone at Prudent Gabriel is celebrating with you today.",
          link: points > 0 ? "/account/loyalty" : undefined,
        });
      }
      processed += 1;
    } catch (e) {
      console.warn("[birthday-wishes]", user.id, e);
      failed += 1;
    }
  }

  return { processed, failed, hasMore: candidates.length >= ctx.batchLimit };
}
