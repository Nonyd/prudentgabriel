import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff/StaffShell";
export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/staff-login");
  }

  const { role, isStaff } = session.user;
  const canAccess = isStaff === true || role === "STAFF";

  if (!canAccess) {
    redirect("/staff-login");
  }

  return <StaffShell session={session}>{children}</StaffShell>;
}
