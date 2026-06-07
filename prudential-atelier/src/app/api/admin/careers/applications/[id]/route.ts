import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { sendJobApplicationStatusEmail } from "@/lib/email";

const patchSchema = z.object({
  status: z.nativeEnum(ApplicationStatus).optional(),
  adminNotes: z.string().optional().nullable(),
  sendStatusEmail: z.boolean().optional(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  const application = await prisma.jobApplication.findUnique({
    where: { id },
    include: {
      job: true,
      emailsSent: { orderBy: { sentAt: "desc" } },
    },
  });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ application });
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.jobApplication.findUnique({
    where: { id },
    include: { job: { select: { title: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const application = await prisma.jobApplication.update({
    where: { id },
    data: {
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.adminNotes !== undefined ? { adminNotes: parsed.data.adminNotes } : {}),
    },
    include: { job: true, emailsSent: { orderBy: { sentAt: "desc" } } },
  });

  if (
    parsed.data.sendStatusEmail &&
    parsed.data.status &&
    parsed.data.status !== existing.status &&
    ["SHORTLISTED", "INTERVIEWED", "REJECTED", "HIRED"].includes(parsed.data.status)
  ) {
    void sendJobApplicationStatusEmail({
      to: application.email,
      name: application.fullName,
      jobTitle: application.job.title,
      status: parsed.data.status,
    }).catch(() => {});
  }

  return NextResponse.json({ application });
}
