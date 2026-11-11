import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveStaffPortalUser } from "@/lib/staff-view-as";
import { creativeAccessFor } from "@/lib/creative-team";
import { commissionTitle } from "@/lib/atelier/commission-list";
import { workroomStageLabel } from "@/lib/client-file";

/**
 * Every client order, for the Creative Team (11 November 2026). Read-only: each
 * row opens the order and her client file. Anyone else in the staff portal is
 * refused — they see their own assignments on the dashboard.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = await resolveStaffPortalUser(session);
  const access = await creativeAccessFor(viewer?.id);
  if (!access.creative) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.bespokeOrder.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderRef: true,
      title: true,
      clientName: true,
      clientProfileId: true,
      occasionType: true,
      occasionDetails: true,
      deliveryDate: true,
      currentStage: true,
      status: true,
      archivedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    illustrator: access.illustrator,
    orders: rows.map((o) => ({
      id: o.id,
      orderRef: o.orderRef,
      title: commissionTitle(o).text,
      clientName: o.clientName,
      clientProfileId: o.clientProfileId,
      deliveryDate: o.deliveryDate?.toISOString() ?? null,
      stageLabel: workroomStageLabel(o.currentStage),
      status: o.status,
      archived: Boolean(o.archivedAt),
      createdAt: o.createdAt.toISOString(),
    })),
  });
}
