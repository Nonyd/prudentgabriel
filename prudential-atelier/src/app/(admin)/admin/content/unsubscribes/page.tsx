import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isGeneralAdminRole } from "@/lib/admin-auth";
import { UnsubscribesClient } from "@/components/admin/content/UnsubscribesClient";

export default async function AdminUnsubscribesPage() {
  const session = await auth();
  if (!session?.user || !isGeneralAdminRole(session.user.role)) {
    redirect("/admin");
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Unsubscribes</h1>
      <p className="mt-1 max-w-2xl font-body text-[13px] text-[#6B6B68]">
        People who opted out of marketing email. They still receive order and account messages.
      </p>
      <UnsubscribesClient />
    </div>
  );
}
