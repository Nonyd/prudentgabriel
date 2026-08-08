import { CronRunStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { getCronJob } from "@/lib/cron/jobs";
import {
  CRON_BATCH_LIMIT,
  CRON_RUN_RETENTION_MS,
  CRON_STUCK_RUNNING_MS,
  RUN_BUDGET_MS,
  type JobResult,
} from "@/lib/cron/types";

function detectHost(): string {
  if (process.env.VERCEL) return "vercel";
  if (process.env.CRON_HOST) return process.env.CRON_HOST;
  return "local";
}

/** Reap killed invocations so RUNNING is never a silent terminal state. */
async function markStuckRunsTimedOut(job: string): Promise<number> {
  const cutoff = new Date(Date.now() - CRON_STUCK_RUNNING_MS);
  const result = await prisma.cronRun.updateMany({
    where: {
      job,
      status: CronRunStatus.RUNNING,
      startedAt: { lt: cutoff },
    },
    data: {
      status: CronRunStatus.TIMED_OUT,
      finishedAt: new Date(),
      error:
        "Reaped: left RUNNING past stuck threshold (host likely killed the function before finish)",
    },
  });
  return result.count;
}

async function pruneOldCronRuns(): Promise<void> {
  const cutoff = new Date(Date.now() - CRON_RUN_RETENTION_MS);
  await prisma.cronRun.deleteMany({
    where: { startedAt: { lt: cutoff } },
  });
}

/**
 * Creates a CronRun row, invokes the migrated handler, updates the row.
 * One failing item inside a handler must not throw — handlers catch per item.
 * A top-level throw marks the run FAILED.
 * Always finishes OK when the time budget is spent (hasMore=true) — that is
 * expected throughput on Hobby, not a failure.
 */
export async function executeCronJob(jobName: string): Promise<{
  result: JobResult;
  runId: string;
  status: CronRunStatus;
}> {
  const def = getCronJob(jobName);
  if (!def) {
    throw new Error(`Unknown cron job: ${jobName}`);
  }
  if (!def.handler) {
    throw new Error(`Cron job ${jobName} is not migrated; call its HTTP route instead`);
  }

  await pruneOldCronRuns();
  await markStuckRunsTimedOut(jobName);

  const run = await prisma.cronRun.create({
    data: {
      job: jobName,
      status: CronRunStatus.RUNNING,
      host: detectHost(),
    },
  });

  const started = Date.now();
  try {
    const result = await def.handler({
      now: new Date(),
      batchLimit: CRON_BATCH_LIMIT,
      isBudgetExhausted: () => Date.now() - started >= RUN_BUDGET_MS,
    });

    const hasMore = Boolean(result.hasMore);

    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        status: CronRunStatus.OK,
        finishedAt: new Date(),
        processed: result.processed,
        failed: result.failed,
        hasMore,
      },
    });

    console.info(
      JSON.stringify({
        cron: jobName,
        runId: run.id,
        status: "OK",
        processed: result.processed,
        failed: result.failed,
        hasMore,
        budgetMs: RUN_BUDGET_MS,
        durationMs: Date.now() - started,
        detail: result.detail ?? null,
      }),
    );

    return { result: { ...result, hasMore }, runId: run.id, status: CronRunStatus.OK };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        status: CronRunStatus.FAILED,
        finishedAt: new Date(),
        error: message,
      },
    });

    await logError({
      severity: "CRITICAL",
      errorType: `CRON_${jobName.toUpperCase().replace(/-/g, "_")}`,
      message,
    });

    console.error(
      JSON.stringify({
        cron: jobName,
        runId: run.id,
        status: "FAILED",
        durationMs: Date.now() - started,
        error: message,
      }),
    );

    throw e;
  }
}
