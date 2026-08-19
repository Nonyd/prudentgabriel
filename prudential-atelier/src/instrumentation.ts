export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.CRON_SCHEDULER !== "1") return;
  const { startCronScheduler } = await import("@/lib/cron/scheduler");
  startCronScheduler();
}
