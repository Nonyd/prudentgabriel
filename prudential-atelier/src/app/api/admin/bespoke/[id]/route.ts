import { NextRequest, NextResponse } from "next/server";
import { BespokeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email";
import { z } from "zod";

const patchSchema = z.object({
  status: z.nativeEnum(BespokeStatus).optional(),
  adminNotes: z.string().optional().nullable(),
  estimatedPrice: z.number().optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
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

  const prev = await prisma.bespokeRequest.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.bespokeRequest.update({
    where: { id },
    data: {
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.adminNotes !== undefined ? { adminNotes: parsed.data.adminNotes } : {}),
      ...(parsed.data.estimatedPrice !== undefined ? { estimatedPrice: parsed.data.estimatedPrice } : {}),
    },
  });

  if (parsed.data.status && parsed.data.status !== prev.status) {
    if (parsed.data.status === "CONFIRMED" || parsed.data.status === "READY") {
      const subject =
        parsed.data.status === "READY"
          ? `Your bespoke piece is ready — ${prev.requestNumber}`
          : `Bespoke request update — ${prev.requestNumber}`;
      const html = `<p>Dear ${prev.name},</p><p>Your bespoke request <strong>${prev.requestNumber}</strong> is now <strong>${parsed.data.status}</strong>.</p>`;
      void sendEmail({ to: prev.email, subject, html });
    }
  }

  return NextResponse.json(updated);
}
