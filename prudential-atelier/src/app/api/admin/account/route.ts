import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPortalApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  image: z.string().url().optional().or(z.literal("")),
});

export async function PATCH(req: NextRequest) {
  const gate = await requireAdminPortalApi();
  if (!gate.ok) return gate.response;

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

  const { name, image } = parsed.data;

  const updated = await prisma.user.update({
    where: { id: gate.session.user.id! },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(image !== undefined ? { image: image || null } : {}),
    },
    select: { name: true, email: true, image: true },
  });

  return NextResponse.json(updated);
}
