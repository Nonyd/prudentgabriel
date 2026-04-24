import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ConsultantWithOfferings } from "@/lib/consultation";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.consultant.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    include: {
      offerings: { where: { isActive: true } },
      availability: { where: { isActive: true } },
    },
  });

  const consultants = rows as ConsultantWithOfferings[];
  return NextResponse.json(
    { consultants },
    { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" } },
  );
}
