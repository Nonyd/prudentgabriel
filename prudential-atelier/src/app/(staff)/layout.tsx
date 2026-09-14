import { authOrNull } from "@/auth";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff/StaffShell";
import { enforcePublicMaintenance } from "@/lib/maintenance";
import { NOINDEX } from "@/lib/seo";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: NOINDEX,
  title: "Staff",
};

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await authOrNull();
  await enforcePublicMaintenance(session?.user);
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
