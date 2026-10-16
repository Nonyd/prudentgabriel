import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isGeneralAdminRole, resolveSessionAccess } from "@/lib/admin-auth";
import { AdminMessagesClient } from "@/components/admin/content/AdminMessagesClient";

export default async function AdminMessagesPage() {
  const session = await auth();
  // The viewed-as role while the Super Admin views as someone, so she sees what they see.
  const access = session?.user ? await resolveSessionAccess(session) : null;
  if (!session?.user || !access || !isGeneralAdminRole(access.role)) {
    redirect("/admin");
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Messages</h1>
      <p className="mt-1 font-body text-sm text-text-mid">Contact form submissions</p>
      <AdminMessagesClient />
    </div>
  );
}
