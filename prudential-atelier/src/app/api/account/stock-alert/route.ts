import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logActivity, logError } from "@/lib/logger";

const alertSchema = z.object({
  variantId: z.string().min(1),
  email: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = alertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email ?? gate.session.user.email;
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  try {
    const variant = await prisma.productVariant.findUnique({
      where: { id: parsed.data.variantId },
      include: { product: { select: { name: true, slug: true } } },
    });
    if (!variant) return NextResponse.json({ error: "Variant not found" }, { status: 404 });

    const alert = await prisma.stockAlert.upsert({
      where: {
        email_variantId: { email, variantId: parsed.data.variantId },
      },
      create: { email, variantId: parsed.data.variantId },
      update: {},
    });

    await logActivity({
      userId: gate.session.user.id,
      action: "CREATE",
      module: "account",
      description: `Stock alert for ${variant.product.name} (${variant.size})`,
      recordId: alert.id,
      recordType: "StockAlert",
    });

    return NextResponse.json({ ok: true, alert });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "STOCK_ALERT",
      message: e instanceof Error ? e.message : "Failed to create stock alert",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
