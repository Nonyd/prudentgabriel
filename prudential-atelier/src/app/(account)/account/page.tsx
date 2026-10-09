import { auth } from "@/auth";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { AccountDashboard } from "@/components/account/AccountDashboard";
import { loadAccountDashboardProps } from "@/lib/account/dashboard-props";

export default async function AccountDashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const profile = await getOrCreateClientProfile(userId);
  const props = await loadAccountDashboardProps({ userId, profile });

  return <AccountDashboard {...props} />;
}
