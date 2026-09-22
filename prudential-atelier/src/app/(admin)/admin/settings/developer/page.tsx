import { auth } from "@/auth";
import { DeveloperSettingsClient } from "@/components/admin/DeveloperSettingsClient";
import { SignOutEveryoneCard } from "@/components/admin/settings/SignOutEveryoneCard";
import { isSuperAdmin } from "@/lib/roles";
import { getSessionsRevokedAt } from "@/lib/session-revocation";

export default async function DeveloperSettingsPage() {
  const session = await auth();
  const superAdmin = isSuperAdmin(session?.user?.role, session?.user?.email);
  const lastRevokedAt = superAdmin ? await getSessionsRevokedAt() : null;
  return (
    <>
      <DeveloperSettingsClient />
      {superAdmin ? (
        <div className="mt-8">
          <SignOutEveryoneCard lastRevokedAt={lastRevokedAt?.toISOString() ?? null} />
        </div>
      ) : null}
    </>
  );
}
