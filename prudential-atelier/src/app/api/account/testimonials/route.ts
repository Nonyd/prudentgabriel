import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canSubmitTestimonial } from "@/lib/testimonial-eligibility";
import { notifyTestimonialSubmitted } from "@/lib/notifications";
import { optionalStoredPublicMediaUrlSchema } from "@/lib/media/stored-url";

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().min(30).max(600),
  clientImage: optionalStoredPublicMediaUrlSchema,
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eligibility = await canSubmitTestimonial(userId);
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reason ?? "Not eligible" }, { status: 403 });
  }
  if (eligibility.hasExistingTestimonial) {
    return NextResponse.json({ error: "You have already submitted a testimonial" }, { status: 409 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  const testimonial = await prisma.testimonial.create({
    data: {
      userId,
      rating: parsed.data.rating,
      body: parsed.data.body.trim(),
      clientImage: parsed.data.clientImage ?? null,
      source: "CLIENT",
    },
  });

  void notifyTestimonialSubmitted({
    testimonialId: testimonial.id,
    userName: user?.name ?? "Client",
    rating: parsed.data.rating,
  });

  return NextResponse.json({ success: true, id: testimonial.id });
}
