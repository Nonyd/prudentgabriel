import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminRole } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) {
    redirect("/admin-login");
  }

  const pendingBespoke = await prisma.bespokeRequest.count({
    where: { status: "PENDING" },
  });

  return (
    <AdminShell session={session} pendingBespokeCount={pendingBespoke}>
      {children}
    </AdminShell>
  );
}
