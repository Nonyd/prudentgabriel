"use client";

import { Suspense, useEffect } from "react";
import type { Session } from "next-auth";
import { AdminImpersonateBanner } from "./AdminImpersonateBanner";
import { AdminMaintenanceBanner } from "./AdminMaintenanceBanner";
import { AdminMobileNav } from "./AdminMobileNav";
import { AdminPreviewBanner } from "./AdminPreviewBanner";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import { PortalImageLightbox } from "@/components/ui/ImageLightbox";
import type { AccessActor } from "@/lib/roles";
import type { ImpersonationPayload } from "@/lib/admin-impersonate";

type AdminShellProps = {
  session: Session;
  children: React.ReactNode;
  badges?: Record<string, number>;
  isMaintenanceOn?: boolean;
  previewRole?: string | null;
  impersonation?: ImpersonationPayload | null;
  accessRole?: string;
  /** The email the menu is built for: the viewed-as person's, or null when previewing a role. */
  accessEmail?: string | null;
  /** While viewing as someone: who the account card shows. */
  viewer?: { name: string; role: string } | null;
  permissionGrants?: readonly string[];
  permissionRevokes?: readonly string[];
  rolePermissions?: AccessActor["rolePermissions"];
};

export function AdminShell({
  session,
  children,
  badges = {},
  isMaintenanceOn = false,
  previewRole = null,
  impersonation = null,
  accessRole,
  accessEmail,
  viewer = null,
  permissionGrants = [],
  permissionRevokes = [],
  rolePermissions,
}: AdminShellProps) {
  const navRole = accessRole ?? session.user?.role ?? "ADMIN";

  useEffect(() => {
    document.documentElement.setAttribute("data-admin-chrome", "");
    return () => document.documentElement.removeAttribute("data-admin-chrome");
  }, []);

  return (
    <div className="admin-area relative flex h-screen overflow-hidden bg-transparent print:h-auto print:overflow-visible">
      <div className="admin-field" aria-hidden="true" />
      {/* The sidebar is desktop only; on phones and tablets the tab bar (AdminMobileNav) takes over. */}
      <div className="relative z-[1] hidden w-[228px] shrink-0 print:hidden lg:block">
        <Suspense fallback={null}>
          <AdminSidebar
            session={session}
            badges={badges}
            accessRole={navRole}
            accessEmail={accessEmail}
            viewer={viewer}
            permissionGrants={permissionGrants}
            permissionRevokes={permissionRevokes}
            rolePermissions={rolePermissions}
            previewRole={previewRole}
          />
        </Suspense>
      </div>
      <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
        <AdminImpersonateBanner impersonation={impersonation} />
        <AdminPreviewBanner previewRole={previewRole} />
        <AdminMaintenanceBanner isMaintenanceOn={isMaintenanceOn} />
        <AdminTopbar />
        <main className="admin-shell admin-main min-h-0 flex-1 overflow-y-auto bg-transparent p-4 print:overflow-visible print:p-0 lg:p-8">{children}</main>
        <PortalImageLightbox />
      </div>
      <Suspense fallback={null}>
        <AdminMobileNav
          session={session}
          badges={badges}
          accessRole={navRole}
          accessEmail={accessEmail}
          viewer={viewer}
          permissionGrants={permissionGrants}
          permissionRevokes={permissionRevokes}
          rolePermissions={rolePermissions}
          previewRole={previewRole}
        />
      </Suspense>
    </div>
  );
}
