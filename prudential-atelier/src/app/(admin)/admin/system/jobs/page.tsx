import { CronJobsClient } from "@/components/admin/CronJobsClient";

export default function AdminSystemJobsPage() {
  return (
    <div>
      <h1 className="admin-heading-pill glass-1 glass-pill font-display text-2xl text-ink">Scheduled jobs</h1>
      <p className="mt-1 max-w-2xl font-body text-13px text-text-mid">
        The work the site does on its own: sending queued emails, reminders, clearing old data and backups. Each job
        runs on its schedule (Lagos time); a failed or overdue job shows here first. Run now starts it immediately.
      </p>
      <CronJobsClient />
    </div>
  );
}
