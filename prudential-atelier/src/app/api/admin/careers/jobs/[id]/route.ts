import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { JobType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { uniqueJobSlug } from "@/lib/job-slug";

const jobBodySchema = z.object({
  title: z.string().min(2).max(200),
  department: z.string().min(1).max(120),
  type: z.nativeEnum(JobType),
  location: z.string().min(1).max(200),
  description: z.string().min(10),
  requirements: z.string().min(10),
  benefits: z.string().optional().nullable(),
  salaryRange: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  isPublished: z.boolean(),
  isPFAPosition: z.boolean(),
  customFields: z.array(z.unknown()).optional().nullable(),
  slug: z.string().optional(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const job = await prisma.jobPosting.findUnique({
    where: { id },
    include: { _count: { select: { applications: true } } },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ job });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = jobBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.jobPosting.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slug = parsed.data.slug?.trim()
    ? parsed.data.slug.trim()
    : parsed.data.title !== existing.title
      ? await uniqueJobSlug(parsed.data.title, id)
      : existing.slug;

  const job = await prisma.jobPosting.update({
    where: { id },
    data: {
      title: parsed.data.title.trim(),
      department: parsed.data.department.trim(),
      type: parsed.data.type,
      location: parsed.data.location.trim(),
      description: parsed.data.description,
      requirements: parsed.data.requirements,
      benefits: parsed.data.benefits?.trim() || null,
      salaryRange: parsed.data.salaryRange?.trim() || null,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
      isPublished: parsed.data.isPublished,
      isPFAPosition: parsed.data.isPFAPosition,
      slug,
      customFields: (parsed.data.customFields ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  return NextResponse.json({ job });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  await prisma.jobPosting.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
