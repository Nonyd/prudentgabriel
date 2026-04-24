import { NextRequest, NextResponse } from "next/server";
import { ConsultationDeliveryMode, ConsultationStatus } from "@prisma/client";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(ConsultationStatus).optional(),
  consultantId: z.string().optional(),
  deliveryMode: z.nativeEnum(ConsultationDeliveryMode).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = querySchema.safeParse(sp);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const q = parsed.data;
  const skip = (q.page - 1) * q.pageSize;

  const where = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.consultantId ? { consultantId: q.consultantId } : {}),
    ...(q.deliveryMode ? { offering: { deliveryMode: q.deliveryMode } } : {}),
    ...(q.dateFrom || q.dateTo
      ? {
          confirmedDate: {
            ...(q.dateFrom ? { gte: q.dateFrom } : {}),
            ...(q.dateTo ? { lte: q.dateTo } : {}),
          },
        }
      : {}),
    ...(q.search
      ? {
          OR: [
            { clientName: { contains: q.search, mode: "insensitive" as const } },
            { clientEmail: { contains: q.search, mode: "insensitive" as const } },
            { bookingNumber: { contains: q.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [bookings, total] = await Promise.all([
    prisma.consultationBooking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: q.pageSize,
      include: {
        consultant: { select: { id: true, name: true, image: true } },
        offering: {
          select: { sessionType: true, deliveryMode: true, durationMinutes: true },
        },
      },
    }),
    prisma.consultationBooking.count({ where }),
  ]);

  const counts = await prisma.consultationBooking.groupBy({
    by: ["status"],
    _count: { status: true },
  });
  const statusCounts = Object.fromEntries(counts.map((c) => [c.status, c._count.status])) as Record<
    string,
    number
  >;

  return NextResponse.json({ bookings, total, statusCounts, page: q.page, pageSize: q.pageSize });
}
