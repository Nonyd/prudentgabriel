import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { AccountShell } from "@/components/account/AccountShell";
import { enforcePublicMaintenance } from "@/lib/maintenance";

export default async function AccountGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  await enforcePublicMaintenance(session?.user?.role);

  if (!session?.user) {
    redirect("/login?callbackUrl=/account");
  }

  const userId = session.user.id;
  if (!userId) {
    redirect("/login?callbackUrl=/account");
  }
  const profile = await getOrCreateClientProfile(userId);

  const [rtwActive, bespokeActive, wishlistCount, userPoints] = await Promise.all([
    prisma.order.count({
      where: { userId, status: { not: "DELIVERED" }, isBespoke: false },
    }),
    prisma.bespokeOrder.count({
      where: {
        clientProfileId: profile.id,
        currentStage: { not: "DELIVERY" },
      },
    }),
    prisma.wishlistItem.count({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { pointsBalance: true },
    }),
  ]);

  return (
    <AccountShell
      session={session}
      tier={profile.loyaltyTier}
      points={userPoints?.pointsBalance ?? 0}
      activeOrders={rtwActive + bespokeActive}
      wishlistCount={wishlistCount}
    >
      {children}
    </AccountShell>
  );
}
