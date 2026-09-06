import { authOrNull } from "@/auth";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff/StaffShell";
import { enforcePublicMaintenance } from "@/lib/maintenance";
export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await authOrNull();
  await enforcePublicMaintenance(session?.user?.role);
  if (!session?.user) {
    redirect("/login?tab=staff");
  }

  const { role, isStaff } = session.user;
  const canAccess = isStaff === true || role === "STAFF";

  if (!canAccess) {
    redirect("/login?tab=staff");
  }

  return <StaffShell session={session}>{children}</StaffShell>;
}
