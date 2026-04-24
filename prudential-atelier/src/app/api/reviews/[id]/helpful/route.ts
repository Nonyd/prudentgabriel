import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const review = await prisma.review.findUnique({
    where: { id: params.id },
    select: { id: true, isApproved: true },
  });

  if (!review || !review.isApproved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.review.update({
    where: { id: params.id },
    data: { helpfulCount: { increment: 1 } },
  });

  return NextResponse.json({ success: true });
}
