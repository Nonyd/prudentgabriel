import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { MeasurementsClient } from "@/components/account/MeasurementsClient";

export default async function MeasurementsPage() {
  const session = await auth();
  const profile = await getOrCreateClientProfile(session!.user!.id!);
  const measurements = await prisma.measurement.findUnique({ where: { clientId: profile.id } });
  return <MeasurementsClient initial={measurements} />;
}
