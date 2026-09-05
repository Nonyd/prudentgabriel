import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { parseCustomFields, validateCustomResponses, type CustomResponses } from "@/lib/job-custom-fields";
import {
  sendJobApplicationAdminEmail,
  sendJobApplicationConfirmationEmail,
} from "@/lib/email";
import { notifyJobApplication } from "@/lib/notifications";
import { storedPrivateMediaUrlSchema, optionalStoredPrivateMediaUrlSchema } from "@/lib/media/stored-url";

const applySchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(30),
  yearsOfExp: z.number().int().min(0).max(50).optional().nullable(),
  coverLetter: z.string().max(1000).optional().nullable(),
  cvUrl: storedPrivateMediaUrlSchema,
  portfolioUrl: optionalStoredPrivateMediaUrlSchema,
  heardFrom: z.string().max(120).optional().nullable(),
  pfaRegNumber: z.string().optional().nullable(),
  pfaVerified: z.boolean().optional(),
  pfaStudentName: z.string().optional().nullable(),
  pfaCourse: z.string().optional().nullable(),
  pfaYear: z.number().int().optional().nullable(),
  universityName: z.string().optional().nullable(),
  supervisorName: z.string().optional().nullable(),
  supervisorEmail: z.string().email().optional().nullable().or(z.literal("")),
  supervisorPhone: z.string().optional().nullable(),
  itDuration: z.string().optional().nullable(),
  itStartDate: z.string().optional().nullable(),
  schoolItLetter: optionalStoredPrivateMediaUrlSchema,
  schoolIdCard: optionalStoredPrivateMediaUrlSchema,
  customResponses: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
    .optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const ip = getClientIp(req);
  const rate = checkRateLimit(`careers-apply:${ip}`, 3, 60 * 60 * 1000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many applications. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  const job = await prisma.jobPosting.findFirst({
    where: { slug, isPublished: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.deadline && job.deadline < new Date()) {
    return NextResponse.json({ error: "Applications for this role have closed" }, { status: 410 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const customFields = parseCustomFields(job.customFields);
  const customError = validateCustomResponses(customFields, (data.customResponses ?? {}) as CustomResponses);
  if (customError) {
    return NextResponse.json({ error: customError }, { status: 400 });
  }

  if (job.isPFAPosition) {
    if (!data.pfaVerified || !data.pfaRegNumber?.trim()) {
      return NextResponse.json({ error: "PFA student verification is required" }, { status: 400 });
    }
  }

  const application = await prisma.jobApplication.create({
    data: {
      jobId: job.id,
      fullName: data.fullName.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      yearsOfExp: data.yearsOfExp ?? null,
      coverLetter: data.coverLetter?.trim() || null,
      cvUrl: data.cvUrl,
      portfolioUrl: data.portfolioUrl || null,
      heardFrom: data.heardFrom || null,
      isPFAApplication: job.isPFAPosition,
      pfaRegNumber: data.pfaRegNumber?.trim().toUpperCase() || null,
      pfaVerified: Boolean(data.pfaVerified),
      pfaStudentName: data.pfaStudentName || null,
      pfaCourse: data.pfaCourse || null,
      pfaYear: data.pfaYear ?? null,
      universityName: data.universityName?.trim() || null,
      supervisorName: data.supervisorName?.trim() || null,
      supervisorEmail: data.supervisorEmail?.trim() || null,
      supervisorPhone: data.supervisorPhone?.trim() || null,
      itDuration: data.itDuration?.trim() || null,
      itStartDate: data.itStartDate ? new Date(data.itStartDate) : null,
      schoolItLetter: data.schoolItLetter || null,
      schoolIdCard: data.schoolIdCard || null,
      customResponses: (data.customResponses ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  void sendJobApplicationConfirmationEmail({
    to: application.email,
    name: application.fullName,
    jobTitle: job.title,
    applicationId: application.id,
  }).catch(() => {});

  void sendJobApplicationAdminEmail({
    jobTitle: job.title,
    name: application.fullName,
    email: application.email,
    phone: application.phone,
    yearsOfExp: application.yearsOfExp,
    applicationId: application.id,
  }).catch(() => {});

  notifyJobApplication({
    applicationId: application.id,
    name: application.fullName,
    jobTitle: job.title,
  });

  return NextResponse.json({ success: true, applicationId: application.id });
}
