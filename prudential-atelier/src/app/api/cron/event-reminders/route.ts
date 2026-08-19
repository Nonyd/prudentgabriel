import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logActivity, logError } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { eventReminderEmailHtml } from "@/lib/email-templates/reports";
import { getPublicAppUrl } from "@/lib/app-url";
import { notifyEventReminder } from "@/lib/customer-notifications";

const REMINDER_DAYS = [60, 30, 14];

function daysUntilEvent(eventDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(eventDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const appUrl = getPublicAppUrl();
    const events = await prisma.eventDate.findMany({
      where: { notified: false },
      include: {
        client: {
          include: { user: { select: { email: true, name: true } } },
        },
      },
    });

    let sent = 0;
    for (const ev of events) {
      const days = daysUntilEvent(ev.date);
      if (!REMINDER_DAYS.includes(days)) continue;

      const email = ev.client.user.email;
      const firstName = (ev.client.user.name ?? "there").split(/\s+/)[0] ?? "there";
      const weeksAway = Math.round(days / 7);

      await sendEmail({
        to: email,
        subject: `${ev.label} is coming up — time to get dressed?`,
        html: eventReminderEmailHtml({
          firstName,
          eventLabel: ev.label,
          weeksAway: weeksAway || 1,
          appUrl,
        }),
        template: "event-reminder",
        idempotencyKey: `event-reminder:${ev.id}:${days}`,
        relatedType: "EventDate",
        relatedId: ev.id,
      });

      await prisma.eventDate.update({
        where: { id: ev.id },
        data: { notified: true },
      });

      notifyEventReminder({
        userId: ev.client.userId,
        eventId: ev.id,
        eventLabel: ev.label,
      });

      await logActivity({
        userId: ev.client.userId,
        action: "UPDATE",
        module: "account",
        description: `Event reminder sent for ${ev.label}`,
        recordId: ev.id,
        recordType: "EventDate",
      });

      sent += 1;
    }

    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    await logError({
      severity: "CRITICAL",
      errorType: "CRON_EVENT_REMINDERS",
      message: e instanceof Error ? e.message : "Event reminders failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
