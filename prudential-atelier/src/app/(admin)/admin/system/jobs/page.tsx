import { CronJobsClient } from "@/components/admin/CronJobsClient";

export default function AdminSystemJobsPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Scheduled jobs</h1>
      <p className="mt-1 max-w-2xl font-body text-[13px] text-[#6B6B68]">
        Registry-backed cron inventory. Migrated jobs write a CronRun row per invocation;
        a row stuck in RUNNING means the host killed the function before finish. ADMIN /
        SUPER_ADMIN only.
      </p>
      <CronJobsClient />
    </div>
  );
}
