import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addressSchema } from "@/validations/order";

const partialSchema = addressSchema.partial().extend({
  isDefault: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = partialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.address.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const d = parsed.data;
  const updated = await prisma.$transaction(async (tx) => {
    if (d.isDefault) {
      await tx.address.updateMany({
        where: { userId: session.user.id },
        data: { isDefault: false },
      });
    }

    return tx.address.update({
      where: { id },
      data: {
        ...(d.firstName != null ? { firstName: d.firstName } : {}),
        ...(d.lastName != null ? { lastName: d.lastName } : {}),
        ...(d.phone != null ? { phone: d.phone } : {}),
        ...(d.line1 != null ? { street: d.line1 } : {}),
        ...(d.line2 !== undefined ? { addressLine2: d.line2 ?? null } : {}),
        ...(d.postalCode !== undefined ? { postalCode: d.postalCode ?? null } : {}),
        ...(d.city != null ? { city: d.city } : {}),
        ...(d.state != null ? { state: d.state } : {}),
        ...(d.country != null ? { country: d.country } : {}),
        ...(d.isDefault != null ? { isDefault: d.isDefault } : {}),
      },
    });
  });

  return NextResponse.json({ address: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.address.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const count = await prisma.address.count({ where: { userId: session.user.id } });
  if (count <= 1) {
    return NextResponse.json({ error: "Cannot delete your only address" }, { status: 400 });
  }

  await prisma.address.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
