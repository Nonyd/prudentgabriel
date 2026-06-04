import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminAccountSettingsClient } from "@/components/admin/AdminAccountSettingsClient";
import { isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminAccountSettingsPage() {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    redirect("/admin-login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true },
  });
  if (!user) redirect("/admin-login");

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
