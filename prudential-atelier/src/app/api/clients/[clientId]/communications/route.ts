import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BESPOKE_ROLES, requireRoles } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logActivity, logError } from "@/lib/logger";
import { sendEmail } from "@/lib/email";

type Params = { params: Promise<{ clientId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireRoles(BESPOKE_ROLES);
  if (!gate.ok) return gate.response;

  const { clientId } = await params;
  const profile = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { userId: true },
  });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const logs = await prisma.activityLog.findMany({
    where: {
      OR: [
        { module: "email", recordId: profile.userId },
        {
          action: { in: ["INVOICE_SEND", "QUOTE_SEND"] },
          recordId: profile.userId,
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      description: true,
      action: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    items: logs.map((log) => ({
      id: log.id,
      date: log.createdAt,
      subject: log.description,
      type: log.action,
      status: "sent",
    })),
  });
}

const sendSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireRoles(BESPOKE_ROLES);
  if (!gate.ok) return gate.response;

  const { clientId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const profile = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await sendEmail({
      to: profile.user.email,
      subject: parsed.data.subject,
      html: parsed.data.body,
      template: "client-communication",
      idempotencyKey: `client-comm:${clientId}:${Date.now()}`,
      relatedType: "ClientProfile",
      relatedId: clientId,
    });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "INVOICE_SEND",
      module: "email",
      description: parsed.data.subject,
      recordId: profile.user.id,
      recordType: "User",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "CLIENT_EMAIL",
      message: e instanceof Error ? e.message : "Failed to send email",
    });
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
