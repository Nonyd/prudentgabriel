import { auth } from "@/auth";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { AccountDashboard } from "@/components/account/AccountDashboard";
import { loadAccountDashboardProps } from "@/lib/account/dashboard-props";
import { ShippingDueBanner } from "@/components/account/ShippingDueBanner";
import { loadShippingDue } from "@/lib/shipping/due";

export default async function AccountDashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const profile = await getOrCreateClientProfile(userId);
  const [props, shippingDue] = await Promise.all([
    loadAccountDashboardProps({ userId, profile }),
    loadShippingDue(userId),
  ]);

  return (
    <>
      {shippingDue.length > 0 ? (
        <div className="mx-auto mb-6 max-w-6xl">
          <ShippingDueBanner items={shippingDue} />
        </div>
      ) : null}
      <AccountDashboard {...props} />
    </>
  );
}
