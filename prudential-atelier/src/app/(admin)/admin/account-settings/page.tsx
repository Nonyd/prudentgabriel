import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminAccountSettingsClient } from "@/components/admin/AdminAccountSettingsClient";
import { isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminAccountSettingsPage() {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    redirect("/login?tab=admin");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true },
  });
  if (!user) redirect("/login?tab=admin");

  return (
    <AdminAccountSettingsClient
      initial={{
        name: user.name ?? "",
        email: user.email,
        image: user.image ?? "",
      }}
    />
  );
}
