import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { StaffAccountSettingsClient } from "@/components/staff/StaffAccountSettingsClient";

export default async function StaffSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?tab=staff");

  const user = session.user;
  const extended = user as { jobTitle?: string; department?: string };

  return (
    <StaffAccountSettingsClient
      initial={{
        name: user.name ?? "",
        email: user.email ?? "",
        image: user.image ?? "",
        jobTitle: extended.jobTitle,
        department: extended.department,
      }}
    />
  );
}
