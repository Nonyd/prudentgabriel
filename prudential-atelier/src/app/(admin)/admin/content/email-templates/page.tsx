import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isGeneralAdminRole } from "@/lib/admin-auth";
import { AdminEmailTemplatesClient } from "@/components/admin/content/AdminEmailTemplatesClient";
import { getAllEmailTemplates } from "@/lib/admin-email-template-store";

export default async function AdminEmailTemplatesPage() {
  const session = await auth();
  if (!session?.user || !isGeneralAdminRole(session.user.role)) {
    redirect("/admin");
  }

  const templates = await getAllEmailTemplates();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Email Templates</h1>
      <p className="mt-1 font-body text-sm text-[#6B6B68]">Edit transactional and marketing email copy</p>
      <AdminEmailTemplatesClient
        templates={templates}
        adminEmail={session.user.email ?? ""}
      />
    </div>
  );
}
