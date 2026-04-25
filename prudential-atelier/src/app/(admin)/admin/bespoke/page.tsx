import { prisma } from "@/lib/prisma";
import { BespokeAdminTable } from "@/components/admin/BespokeAdminTable";
import { ManualBespokeForm } from "@/components/admin/ManualBespokeForm";

export default async function AdminBespokePage() {
  const rows = await prisma.bespokeRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-2xl text-ink">Bespoke requests</h1>
        <ManualBespokeForm />
      </div>
      <BespokeAdminTable initial={rows} />
    </div>
  );
}
