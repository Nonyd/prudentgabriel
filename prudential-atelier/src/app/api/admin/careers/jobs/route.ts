import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { JobType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { uniqueJobSlug } from "@/lib/job-slug";

const richTextMin = (label: string) =>
  z
    .string()
    .refine(
      (v) =>
        v
          .replace(/<[^>]*>/g, " ")
          .replace(/&nbsp;/gi, " ")
          .replace(/\s+/g, " ")
          .trim().length >= 10,
      { message: `Add a ${label} — at least a short sentence` },
    );

const jobBodySchema = z.object({
  title: z.string().min(2, "Add a job title").max(200),
  department: z.string().min(1, "Add a department").max(120),
  type: z.nativeEnum(JobType),
  location: z.string().min(1, "Add a location").max(200),
  description: richTextMin("description"),
  requirements: richTextMin("requirements list"),
  benefits: z.string().optional().nullable(),
  salaryRange: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  isPublished: z.boolean(),
  isPFAPosition: z.boolean(),
  customFields: z.array(z.unknown()).optional().nullable(),
  slug: z.string().optional(),
});

export async function GET() {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const jobs = await prisma.jobPosting.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });

  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = jobBodySchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
    return NextResponse.json(
      {
        error: `${where}${issue?.message ?? "Invalid request"}`,
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const slug = parsed.data.slug?.trim()
    ? parsed.data.slug.trim()
    : await uniqueJobSlug(parsed.data.title);

  const job = await prisma.jobPosting.create({
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
      createdBy: gate.session.user!.id!,
    },
  });

  return NextResponse.json({ job });
}
