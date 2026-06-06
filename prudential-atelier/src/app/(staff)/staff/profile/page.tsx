import { redirect } from "next/navigation";

export default function StaffProfileRedirectPage() {
  redirect("/staff/settings");
}
