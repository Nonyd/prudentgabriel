import { NextRequest, NextResponse } from "next/server";
import { ApplicationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireGeneralAdminApi } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const status = searchParams.get("status");
  const pfaOnly = searchParams.get("pfaOnly") === "true";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Prisma.JobApplicationWhereInput = {};
  if (jobId) where.jobId = jobId;
  if (status && Object.values(ApplicationStatus).includes(status as ApplicationStatus)) {
    where.status = status as ApplicationStatus;
  }
  if (pfaOnly) where.isPFAApplication = true;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const applications = await prisma.jobApplication.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { job: { select: { title: true, slug: true } } },
  });

  return NextResponse.json({ applications });
}
