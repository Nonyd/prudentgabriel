import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { AccountShell } from "@/components/account/AccountShell";

export default async function AccountGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }

  const userId = session.user.id;
  const profile = await getOrCreateClientProfile(userId);

  const [rtwActive, bespokeActive, wishlistCount] = await Promise.all([
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
  ]);

  return (
    <AccountShell
      session={session}
      tier={profile.loyaltyTier}
      activeOrders={rtwActive + bespokeActive}
      wishlistCount={wishlistCount}
    >
      {children}
    </AccountShell>
  );
}
