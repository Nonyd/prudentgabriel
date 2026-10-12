import { prisma } from "@/lib/prisma";
import { BespokePipelineClient } from "@/components/admin/BespokePipelineClient";
import { commissionListSelect, commissionRow, fabricPendingWhere } from "@/lib/atelier/commission-list";

export default async function AdminBespokePipelinePage() {
  const [rows, fabricPending] = await Promise.all([
    prisma.bespokeOrder.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: commissionListSelect,
    }),
    prisma.bespokeOrder.count({ where: fabricPendingWhere() }),
  ]);

  // Same rows as GET /api/bespoke: no email, receipt or money (BD1, BD4).
  return <BespokePipelineClient initial={rows.map(commissionRow)} initialFabricPending={fabricPending} />;
}
