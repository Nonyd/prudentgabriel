import { authOrNull } from "@/auth";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff/StaffShell";
import { WorkroomTypeScale } from "@/components/common/WorkroomTypeScale";
import { enforcePublicMaintenance } from "@/lib/maintenance";
import { NOINDEX } from "@/lib/seo";
import { resolveStaffPortalUser } from "@/lib/staff-view-as";
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

  // Themselves, or the staff member the Super Admin is viewing as (read-only).
  const viewer = await resolveStaffPortalUser(session);
  if (!viewer || !(viewer.isStaff || viewer.role === "STAFF")) {
    redirect("/login?tab=staff");
  }

  return (
    <StaffShell
      session={session}
      viewer={{ name: viewer.name, email: viewer.email, image: viewer.image }}
      viewingAs={viewer.viewingAs}
    >
      <WorkroomTypeScale />
      {children}
    </StaffShell>
  );
}
