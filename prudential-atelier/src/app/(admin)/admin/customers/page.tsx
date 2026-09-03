import { redirect } from "next/navigation";

/** Slice U: Clients is the CRM. This URL was a thinner customer list. */
export default function AdminCustomersRedirect() {
  redirect("/admin/clients");
}
