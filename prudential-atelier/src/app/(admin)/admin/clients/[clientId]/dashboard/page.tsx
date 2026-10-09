import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveSessionAccess } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/roles";
import { canPreviewClientDashboard, resolveClientFileAccess } from "@/lib/client-file";
import { loadAccountDashboardProps } from "@/lib/account/dashboard-props";
import { AccountDashboard } from "@/components/account/AccountDashboard";
import { logActivity } from "@/lib/logger";

type Props = { params: Promise<{ clientId: string }> };

/**
 * "Preview her dashboard": what the client sees at /account, read-only.
 *
 * Nobody's session changes. Her dashboard is rendered from her own data by the
 * same loader and component as her page, inside an `inert` frame, so nothing in
 * it can be clicked or submitted. Open only to a viewer who already sees every
 * section of her file (canPreviewClientDashboard). Each view is logged.
 */
export default async function ClientDashboardPreviewPage({ params }: Props) {
  const { clientId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login?tab=admin");

  const profile = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    include: { user: { select: { name: true } } },
  });
  if (!profile) notFound();

  const { role, actor, impersonation } = await resolveSessionAccess(session);
  const access = await resolveClientFileAccess(
    { userId: session.user.id, role, email: actor.email ?? null, allows: (p) => hasPermission(role, p, actor) },
    profile.id,
  );
  const name = profile.user.name ?? "This client";

  if (!canPreviewClientDashboard(access)) {
    return (
      <div className="space-y-4">
        <BackLink clientId={profile.id} />
        <p className="card-surface p-6 font-sans text-sm text-text-mid">
          Her dashboard shows her balances, measurements and consultations, so the preview is open only to those who
          see every part of her client file.
        </p>
      </div>
    );
  }

  await logActivity({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    userRole: session.user.role ?? undefined,
    impersonatedUserId: impersonation?.targetId,
    action: "CLIENT_DASHBOARD_PREVIEW",
    module: "clients",
    description: `Previewed ${name}'s dashboard`,
    recordId: profile.id,
    recordType: "ClientProfile",
  });

  const dashboard = await loadAccountDashboardProps({ userId: profile.userId, profile, preview: true });

  return (
    <div className="space-y-4">
      <BackLink clientId={profile.id} />
      <div className="border border-gold/40 bg-[#FAF6EE] px-5 py-4 font-sans text-sm text-ink" role="note">
        <p className="font-medium">Preview — what {name} sees on her dashboard.</p>
        <p className="mt-1 text-[13px] text-text-mid">
          Read-only: nothing here can be clicked, and you are still signed in as yourself. Her sidebar and the pages
          behind each link are not shown.
        </p>
      </div>
      <div className="relative overflow-hidden">
        <div className="storefront-field" aria-hidden="true" />
        <div className="relative z-[1] px-2 py-6 sm:px-6">
          <div className="glass-opaque px-4 py-5 sm:px-6" inert>
            <AccountDashboard {...dashboard} />
          </div>
        </div>
      </div>
    </div>
  );
}

function BackLink({ clientId }: { clientId: string }) {
  return (
    <Link href={`/admin/clients/${clientId}`} className="font-sans text-xs uppercase tracking-[0.12em] text-text-mid hover:text-ink">
      ← Client file
    </Link>
  );
}
