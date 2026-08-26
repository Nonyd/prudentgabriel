import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isGeneralAdminRole } from "@/lib/admin-auth";
import { AdminSendEmailClient } from "@/components/admin/content/AdminSendEmailClient";
import { getAllEmailTemplates } from "@/lib/admin-email-template-store";

export default async function AdminSendEmailPage() {
  const session = await auth();
  if (!session?.user || !isGeneralAdminRole(session.user.role)) {
    redirect("/admin");
  }

  const templates = await getAllEmailTemplates();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Send Email</h1>
      <p className="mt-1 font-body text-sm text-[#6B6B68]">
        Queue a campaign to the newsletter, customers, or past buyers. Sending continues after you leave this page.
      </p>
      <AdminSendEmailClient templates={templates} />
    </div>
  );
}
