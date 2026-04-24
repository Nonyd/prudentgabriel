import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProfileFormClient } from "@/components/account/ProfileFormClient";

export default async function ProfilePage() {
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id: session!.user!.id! },
    select: { name: true, email: true, phone: true, image: true },
  });
  const parts = (user?.name ?? "").trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-3xl text-wine">Profile</h1>
      <ProfileFormClient
        initial={{ firstName, lastName, email: user?.email ?? "", phone: user?.phone ?? "", image: user?.image ?? "" }}
      />
    </div>
  );
}
