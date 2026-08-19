import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email";

const bodySchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const application = await prisma.jobApplication.findUnique({ where: { id } });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const safeBody = parsed.data.body.replace(/</g, "&lt;").replace(/\n/g, "<br/>");

  await sendEmail({
    to: application.email,
    subject: parsed.data.subject,
    html: `<div style="font-family: Georgia, serif; line-height: 1.7; color: #442913;">${safeBody}</div>`,
    template: "career-application-email",
    idempotencyKey: `career-email:${id}:${Date.now()}`,
    relatedType: "JobApplication",
    relatedId: id,
  });

  await prisma.applicationEmail.create({
    data: {
      applicationId: id,
      subject: parsed.data.subject,
      body: parsed.data.body,
      sentBy: gate.session.user!.id!,
    },
  });

  return NextResponse.json({ success: true });
}
