"use client";

import { Suspense, useState } from "react";
import type { Session } from "next-auth";
import { AdminImpersonateBanner } from "./AdminImpersonateBanner";
import { AdminMaintenanceBanner } from "./AdminMaintenanceBanner";
import { AdminPreviewBanner } from "./AdminPreviewBanner";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
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
  permissionGrants = [],
  permissionRevokes = [],
  rolePermissions,
}: AdminShellProps) {
  const [mobileNav, setMobileNav] = useState(false);
  const navRole = accessRole ?? session.user?.role ?? "ADMIN";

  return (
    <div className="admin-area flex h-screen overflow-hidden bg-bg-page print:h-auto print:overflow-visible">
      {mobileNav ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      ) : null}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[228px] shrink-0 transition-transform duration-200 print:hidden md:static md:z-0 md:translate-x-0 ${
          mobileNav ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <Suspense fallback={null}>
          <AdminSidebar
            session={session}
            badges={badges}
            onNavigate={() => setMobileNav(false)}
            accessRole={navRole}
            permissionGrants={permissionGrants}
            permissionRevokes={permissionRevokes}
            rolePermissions={rolePermissions}
            previewRole={previewRole}
          />
        </Suspense>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
        <AdminImpersonateBanner impersonation={impersonation} />
        <AdminPreviewBanner previewRole={previewRole} />
        <AdminMaintenanceBanner isMaintenanceOn={isMaintenanceOn} />
        <AdminTopbar onOpenNav={() => setMobileNav(true)} />
        <main className="admin-shell min-h-0 flex-1 overflow-y-auto bg-bg-page p-4 print:overflow-visible print:p-0 md:p-8">{children}</main>
      </div>
    </div>
  );
}
