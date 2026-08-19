import { NextRequest, NextResponse } from "next/server";
import { CronRunStatus } from "@prisma/client";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { CRON_JOBS, cronPath, getCronJob } from "@/lib/cron/jobs";
import { executeCronJob } from "@/lib/cron/runner";
import { isJobStale } from "@/lib/cron/schedule";
import { getPublicAppUrl } from "@/lib/app-url";

export async function GET() {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const latestByJob = await prisma.cronRun.findMany({
    where: { job: { in: CRON_JOBS.map((j) => j.name) } },
    orderBy: { startedAt: "desc" },
    distinct: ["job"],
  });
  const lastMap = Object.fromEntries(latestByJob.map((r) => [r.job, r]));

  const lastOkRows = await prisma.cronRun.findMany({
    where: {
      job: { in: CRON_JOBS.map((j) => j.name) },
      status: CronRunStatus.OK,
    },
    orderBy: { startedAt: "desc" },
    distinct: ["job"],
  });
  const lastOkMap = Object.fromEntries(lastOkRows.map((r) => [r.job, r]));

  const now = new Date();
  const jobs = CRON_JOBS.map((def) => {
    const last = lastMap[def.name] ?? null;
    const lastOk = lastOkMap[def.name] ?? null;
    const durationMs =
      last?.finishedAt && last.startedAt
        ? last.finishedAt.getTime() - last.startedAt.getTime()
        : null;
    const stale = isJobStale({
      schedule: def.schedule,
      lastOkAt: lastOk?.finishedAt ?? lastOk?.startedAt ?? null,
      now,
      budgetMs: def.budgetMs,
    });
    return {
      name: def.name,
      schedule: def.schedule,
      description: def.description,
      migrated: def.migrated,
      path: cronPath(def.name),
      lastRun: last
        ? {
            id: last.id,
            status: last.status,
            startedAt: last.startedAt.toISOString(),
            finishedAt: last.finishedAt?.toISOString() ?? null,
            processed: last.processed,
            failed: last.failed,
            hasMore: last.hasMore,
            error: last.error,
            host: last.host,
            durationMs,
          }
        : null,
      stale,
    };
  });

  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const def = getCronJob(name);
  if (!def) {
    return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  }

  // Migrated jobs: always go through executeCronJob (same 8s budget as cron).
  if (def.migrated && def.handler) {
    try {
      const { result, runId, status } = await executeCronJob(name);
      return NextResponse.json({
        ok: true,
        runId,
        status,
        processed: result.processed,
        failed: result.failed,
        hasMore: result.hasMore ?? false,
        detail: result.detail,
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Job failed" },
        { status: 500 },
      );
    }
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const base = getPublicAppUrl().replace(/\/$/, "");
  const url = `${base}${cronPath(name)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: "Legacy job route failed", status: res.status, payload },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, legacy: true, payload });
}
