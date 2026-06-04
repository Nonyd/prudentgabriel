import { prisma } from "@/lib/prisma";
import { BespokeAdminTable } from "@/components/admin/BespokeAdminTable";

export default async function BespokeIntakePage() {
  const rows = await prisma.bespokeRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Bespoke</p>
        <h1 className="font-display text-2xl text-ink">Intake Requests</h1>
        <p className="mt-1 font-sans text-sm text-text-mid">
          Simple enquiry form submissions — separate from the production pipeline
        </p>
      </div>
      <BespokeAdminTable initial={rows} />
    </div>
  );
}
