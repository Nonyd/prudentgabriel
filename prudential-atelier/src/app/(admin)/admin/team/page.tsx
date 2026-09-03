import { redirect } from "next/navigation";

/** Slice U: Users & Roles is the staff admin. This URL was an invite-only overlap. */
export default function AdminTeamRedirect() {
  redirect("/admin/settings/users");
}
