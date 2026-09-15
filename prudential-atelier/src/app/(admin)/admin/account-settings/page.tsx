import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminAccountSettingsClient } from "@/components/admin/AdminAccountSettingsClient";
import { resolveSessionAccess } from "@/lib/admin-auth";
import { hasAnyAdminPermission } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminAccountSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?tab=admin");
  }
  const { role, actor } = await resolveSessionAccess(session);
  if (!hasAnyAdminPermission(role, actor)) {
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
      canChangeEmail={session.user.role === "SUPER_ADMIN"}
    />
  );
}
