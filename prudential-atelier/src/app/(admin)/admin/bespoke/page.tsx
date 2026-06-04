import { prisma } from "@/lib/prisma";
import { BespokePipelineClient } from "@/components/admin/BespokePipelineClient";

export default async function AdminBespokePipelinePage() {
  const rows = await prisma.bespokeOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return <BespokePipelineClient initial={rows} />;
}
