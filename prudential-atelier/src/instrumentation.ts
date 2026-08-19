export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (process.env.CRON_SCHEDULER !== "1") return;
  const { startCronScheduler } = await import("@/lib/cron/scheduler");
  startCronScheduler();
}
