import { prisma } from "@/lib/prisma";
import { BespokePipelineClient } from "@/components/admin/BespokePipelineClient";

export default async function AdminBespokePipelinePage() {
  const rows = await prisma.bespokeOrder.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      stageApprovals: {
        where: { status: "PENDING" },
        select: { id: true, stage: true, status: true },
      },
    },
  });

  return <BespokePipelineClient initial={rows} />;
}
