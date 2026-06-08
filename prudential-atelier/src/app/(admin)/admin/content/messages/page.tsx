import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isGeneralAdminRole } from "@/lib/admin-auth";
import { AdminMessagesClient } from "@/components/admin/content/AdminMessagesClient";

export default async function AdminMessagesPage() {
  const session = await auth();
  if (!session?.user || !isGeneralAdminRole(session.user.role)) {
    redirect("/admin");
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Messages</h1>
      <p className="mt-1 font-body text-sm text-[#6B6B68]">Contact form submissions</p>
      <AdminMessagesClient />
    </div>
  );
}
