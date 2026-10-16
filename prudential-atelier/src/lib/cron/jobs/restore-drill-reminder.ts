import type { CronJobContext, JobResult } from "@/lib/cron/types";
import { sendEmail } from "@/lib/email";
import { alertEmailTargets } from "@/lib/admin-alerts";

/**
 * AZ10: a restore proved once is a restore nobody knows is broken next quarter.
 * Four times a year this asks the house to run the timed restore drill in
 * deploy/DEPLOY.md ("Restore from backup") and record the time it took.
 * It only reminds; the drill itself is run by hand on the server.
 */
export async function run(ctx: CronJobContext): Promise<JobResult> {
  const targets = await alertEmailTargets("system");
  if (targets.length === 0) return { processed: 0, failed: 0, hasMore: false, detail: { skipped: "no alert address" } };
  const quarter = `${ctx.now.getUTCFullYear()}-Q${Math.floor(ctx.now.getUTCMonth() / 3) + 1}`;
  for (const { to } of targets) await sendEmail({
    to,
    subject: `Restore drill due — ${quarter} | Prudent Gabriel`,
    html: [
      "<p>This quarter's backup restore drill is due.</p>",
      "<p>Follow <strong>deploy/DEPLOY.md → Restore from backup</strong>: decrypt last night's production dump with Prudent Gabriel's key, restore it into a scratch database, check the counts and the payment ledger total, and open one receipt from the media archive.</p>",
      "<p>Write down how long decrypt and restore took. If any step needed improvising, that step is the one to fix.</p>",
    ].join(""),
    template: "restore-drill-reminder",
    idempotencyKey: `restore-drill-reminder:${quarter}:${to}`,
  });
  return { processed: targets.length, failed: 0, hasMore: false, detail: { quarter } };
}
