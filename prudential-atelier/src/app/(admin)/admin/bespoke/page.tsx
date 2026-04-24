import { prisma } from "@/lib/prisma";
import { BespokeAdminTable } from "@/components/admin/BespokeAdminTable";

export default async function AdminBespokePage() {
  const rows = await prisma.bespokeRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div>
      <h1 className="font-display text-2xl text-ivory">Bespoke requests</h1>
      <BespokeAdminTable initial={rows} />
    </div>
  );
}
