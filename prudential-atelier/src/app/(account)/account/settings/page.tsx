import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getNotificationPrefs } from "@/lib/account-helpers";
import { SettingsClient } from "@/components/account/SettingsClient";

export default async function SettingsPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [user, prefs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true, image: true },
    }),
    getNotificationPrefs(userId),
  ]);

  const parts = (user?.name ?? "").trim().split(/\s+/);

  return (
    <SettingsClient
      initial={{
        firstName: parts[0] ?? "",
        lastName: parts.slice(1).join(" "),
        email: user?.email ?? "",
        phone: user?.phone ?? null,
        image: user?.image ?? null,
      }}
      prefs={prefs as {
        orderStage: boolean;
        newCollections: boolean;
        wishlistRestock: boolean;
        eventReminders: boolean;
      }}
    />
  );
}
