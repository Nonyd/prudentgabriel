import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminRole } from "@/lib/admin-auth";
import { AdminLoginClient } from "./AdminLoginClient";

export default async function AdminLoginPage() {
  const session = await auth();
  if (session?.user && isAdminRole(session.user.role)) {
    redirect("/admin");
  }

  return (
    <div className="admin-area min-h-screen bg-white text-charcoal">
      <AdminLoginClient />
    </div>
  );
}
