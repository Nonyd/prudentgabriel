import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { adminTestimonialBodySchema, toTestimonialWriteData } from "@/lib/admin-testimonial-schema";

export async function POST(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = adminTestimonialBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.userId) {
    const user = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
  }

  const testimonial = await prisma.testimonial.create({
    data: {
      ...toTestimonialWriteData(parsed.data),
      source: "ADMIN",
    },
  });

  return NextResponse.json({ success: true, testimonial });
}
