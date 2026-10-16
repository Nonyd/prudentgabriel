import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isGeneralAdminRole } from "@/lib/admin-auth";
import { AdminEmailTemplatesClient } from "@/components/admin/content/AdminEmailTemplatesClient";
import { getAllEmailTemplates } from "@/lib/admin-email-template-store";
import Link from "next/link";

export default async function AdminEmailTemplatesPage() {
  const session = await auth();
  if (!session?.user || !isGeneralAdminRole(session.user.role)) {
    redirect("/admin");
  }

  const templates = await getAllEmailTemplates();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Email Templates</h1>
      <p className="mt-1 font-body text-sm text-text-mid">
        Ready-to-wear, made-to-order stage mail, consultations, and account copy. Saving a template changes what
        customers actually receive.
      </p>
      {session.user.role === "SUPER_ADMIN" ? (
        <Link
          href="/admin/content/email-templates/founder-note"
          className="mt-4 block border border-sand bg-bg-surface px-4 py-3 font-body text-sm text-ink hover:border-choc"
        >
          <span className="font-medium">Founder&apos;s note</span>
          <span className="text-text-mid">
            {" "}
            · the personal letter from Mrs Prudent Gabriel-Okopi, sent ten minutes after a client joins. Edit the words →
          </span>
        </Link>
      ) : null}
      <AdminEmailTemplatesClient
        templates={templates}
        adminEmail={session.user.email ?? ""}
      />
    </div>
  );
}
