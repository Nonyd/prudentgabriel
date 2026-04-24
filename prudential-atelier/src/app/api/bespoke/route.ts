import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateBespokeNumber } from "@/lib/order-number";
import { sendBespokeConfirmationEmail, sendAdminNotificationEmail } from "@/lib/email";
import { bespokeRequestSchema } from "@/validations/bespoke";

export async function POST(req: NextRequest) {
  const session = await auth();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bespokeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const requestNumber = generateBespokeNumber();

  await prisma.bespokeRequest.create({
    data: {
      requestNumber,
      userId: session?.user?.id ?? null,
      name: d.name,
      email: d.email,
      phone: d.phone,
      country: d.country,
      source: d.source,
      occasion: d.occasion,
      description: d.description,
      budgetRange: d.budgetRange,
      timeline: d.timeline,
      measurements: d.measurements ? (d.measurements as object) : undefined,
      referenceImages: d.referenceImages ?? [],
      preferredDate: d.preferredDate ?? null,
    },
  });

  void sendBespokeConfirmationEmail(
    d.email,
    d.name,
    requestNumber,
    d.occasion,
    d.timeline ?? d.budgetRange ?? "—",
  );
  void sendAdminNotificationEmail(
    `New bespoke request ${requestNumber}`,
    `<p>${d.name} — ${d.email}</p><p>${d.description}</p>`,
  );

  return NextResponse.json({ success: true, requestNumber });
}
