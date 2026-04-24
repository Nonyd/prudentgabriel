import { NextRequest, NextResponse } from "next/server";
import { BespokeStatus } from "@prisma/client";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { generateBespokeNumber } from "@/lib/order-number";
import { notifyNewBespoke } from "@/lib/notifications";

const manualSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(5),
  email: z.string().optional(),
  country: z.string().min(2),
  heardFrom: z.string().min(1),
  occasion: z.string().min(1),
  description: z.string().min(10),
  budgetRange: z.string().min(1),
  timeline: z.string().min(1),
  agreedPrice: z.number().positive(),
  depositPaid: z.number().nonnegative().optional(),
  paymentMethod: z.string().min(1),
  referenceImageUrls: z.array(z.string()).max(5).default([]),
  sketchUrls: z.array(z.string()).max(10).default([]),
  measurements: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  adminNotes: z.string().optional(),
  status: z.nativeEnum(BespokeStatus).optional(),
});

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const json = await req.json().catch(() => null);
  const parsed = manualSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const requestNumber = generateBespokeNumber();
  const deposit = d.depositPaid ?? 0;
  const balance = Math.max(0, d.agreedPrice - deposit);
  const paymentNote = `\n\nPayment: ${d.paymentMethod}. Deposit: ₦${deposit}. Balance: ₦${balance}.`;
  const adminNotes = [d.adminNotes?.trim(), paymentNote].filter(Boolean).join("");
  const emailTrim = d.email?.trim();
  const email =
    emailTrim && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim) ? emailTrim : "manual@prudentgabriel.local";

  const status = d.status ?? BespokeStatus.CONFIRMED;

  const row = await prisma.bespokeRequest.create({
    data: {
      requestNumber,
      name: d.name,
      email,
      phone: d.phone,
      country: d.country,
      source: d.heardFrom,
      occasion: d.occasion,
      description: d.description,
      budgetRange: d.budgetRange,
      timeline: d.timeline,
      referenceImages: d.referenceImageUrls,
      sketchUrls: d.sketchUrls,
      measurements: d.measurements ? (d.measurements as object) : undefined,
      adminNotes: adminNotes || null,
      status,
      estimatedPrice: d.agreedPrice,
      agreedPrice: d.agreedPrice,
      depositPaid: deposit,
      paymentMethod: d.paymentMethod,
      entrySource: "MANUAL_ADMIN_ENTRY",
    },
  });

  void notifyNewBespoke(row);

  return NextResponse.json({ success: true, requestNumber: row.requestNumber, id: row.id });
}
