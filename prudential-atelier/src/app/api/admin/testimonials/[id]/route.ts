import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";

const patchSchema = z
  .object({
    isApproved: z.boolean().optional(),
    showOnHomepage: z.boolean().optional(),
    productContext: z.string().max(200).optional().nullable(),
    orderContext: z.string().max(200).optional().nullable(),
    adminImage: z.string().url().optional().nullable(),
  })
  .refine(
    (d) =>
      d.isApproved !== undefined ||
      d.showOnHomepage !== undefined ||
      d.productContext !== undefined ||
      d.orderContext !== undefined ||
      d.adminImage !== undefined,
    { message: "At least one field required" },
  );

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
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.testimonial.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: {
    isApproved?: boolean;
    showOnHomepage?: boolean;
    productContext?: string | null;
    orderContext?: string | null;
    adminImage?: string | null;
  } = {};

  if (parsed.data.isApproved !== undefined) data.isApproved = parsed.data.isApproved;
  if (parsed.data.productContext !== undefined) data.productContext = parsed.data.productContext;
  if (parsed.data.orderContext !== undefined) data.orderContext = parsed.data.orderContext;
  if (parsed.data.adminImage !== undefined) data.adminImage = parsed.data.adminImage;

  if (parsed.data.showOnHomepage !== undefined) {
    const approved = parsed.data.isApproved ?? existing.isApproved;
    if (parsed.data.showOnHomepage && !approved) {
      return NextResponse.json({ error: "Only approved testimonials can appear on the homepage" }, { status: 400 });
    }
    data.showOnHomepage = parsed.data.showOnHomepage;
  }
  if (parsed.data.isApproved === false) {
    data.showOnHomepage = false;
  }

  const updated = await prisma.testimonial.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  await prisma.testimonial.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
