"use client";

import { useState } from "react";
import type { Session } from "next-auth";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";

type AdminShellProps = {
  session: Session;
  pendingBespokeCount: number;
  children: React.ReactNode;
};

export function AdminShell({ session, pendingBespokeCount, children }: AdminShellProps) {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="admin-area flex h-screen overflow-hidden bg-white">
      {mobileNav ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      ) : null}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[220px] shrink-0 transition-transform duration-200 md:static md:z-0 md:translate-x-0 ${
          mobileNav ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <AdminSidebar session={session} onNavigate={() => setMobileNav(false)} />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AdminTopbar pendingBespokeCount={pendingBespokeCount} onOpenNav={() => setMobileNav(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto bg-white p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
