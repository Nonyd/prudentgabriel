import { NextRequest, NextResponse } from "next/server";
import { PaymentGateway } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  image: z.string().url().optional().or(z.literal("")),
  preferredGateway: z.nativeEnum(PaymentGateway).nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      image: true,
      pointsBalance: true,
      referralCode: true,
      preferredGateway: true,
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parts = (user.name ?? "").trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");

  return NextResponse.json({
    firstName,
    lastName,
    email: user.email,
    phone: user.phone,
    image: user.image,
    pointsBalance: user.pointsBalance,
    referralCode: user.referralCode,
    preferredGateway: user.preferredGateway,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const { firstName, lastName, phone, image, preferredGateway } = parsed.data;
  const name =
    firstName != null || lastName != null
      ? `${firstName ?? ""} ${lastName ?? ""}`.trim() || undefined
      : undefined;

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(name ? { name } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(image !== undefined ? { image: image || null } : {}),
      ...(preferredGateway !== undefined ? { preferredGateway } : {}),
    },
    select: {
      name: true,
      email: true,
      phone: true,
      image: true,
      pointsBalance: true,
      referralCode: true,
      preferredGateway: true,
    },
  });

  const parts = (updated.name ?? "").trim().split(/\s+/);
  return NextResponse.json({
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    email: updated.email,
    phone: updated.phone,
    image: updated.image,
    pointsBalance: updated.pointsBalance,
    referralCode: updated.referralCode,
    preferredGateway: updated.preferredGateway,
  });
}
