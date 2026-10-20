import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { StaffAccountSettingsClient } from "@/components/staff/StaffAccountSettingsClient";
import { resolveStaffPortalUser } from "@/lib/staff-view-as";

export default async function StaffSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?tab=staff");

  // While viewing as a staff member, their settings (read-only: changes are refused).
  const user = (await resolveStaffPortalUser(session))!;

  return (
    <StaffAccountSettingsClient
      initial={{
        name: user.name ?? "",
        email: user.email ?? "",
        image: user.image ?? "",
        jobTitle: user.jobTitle,
        department: user.department,
      }}
    />
  );
}
