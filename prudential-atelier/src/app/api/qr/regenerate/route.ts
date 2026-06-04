import { NextResponse } from "next/server";
import { HR_ROLES, requireRoles } from "@/lib/api-auth";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { rotateDailyQR } from "@/lib/qr-attendance";
import QRCode from "qrcode";

export async function POST() {
  const gate = await requireRoles(HR_ROLES);
  if (!gate.ok) return gate.response;

  try {
    const code = await rotateDailyQR();
    const payload = JSON.stringify({
      code,
      date: new Date().toISOString().slice(0, 10),
      location: "Atelier Floor",
    });
    const dataUrl = await QRCode.toDataURL(payload, { width: 400, margin: 2 });
    return NextResponse.json({ code, payload, dataUrl });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "QR_REGENERATE",
      message: e instanceof Error ? e.message : "Failed to regenerate QR",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  const gate = await requireRoles(HR_ROLES);
  if (!gate.ok) return gate.response;

  const history = await prisma.qRCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 14,
    select: {
      id: true,
      code: true,
      createdAt: true,
      expiresAt: true,
      isActive: true,
    },
  });

  return NextResponse.json({ items: history });
}
