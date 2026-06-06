"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { useState } from "react";
import { Bell, ClipboardList, Clock, Home, LogOut, Menu, User } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { cn, getInitials } from "@/lib/utils";

const NAV = [
  { href: "/staff", label: "Home", icon: Home },
  { href: "/staff/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/staff/time", label: "Time", icon: Clock },
  { href: "/staff/profile", label: "Profile", icon: User },
];

function isNavActive(pathname: string, href: string) {
  if (href === "/staff") return pathname === "/staff";
  return pathname.startsWith(href);
}

export function StaffShell({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const name = session.user?.name ?? session.user?.email ?? "Staff";
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {mobileNav ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[240px] shrink-0 flex-col border-r border-sand/30 bg-choc transition-transform duration-200 md:static md:z-0 md:translate-x-0",
          mobileNav ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="border-b border-cream/10 p-5">
          <Logo variant="white" size="sm" themeAdaptive={false} href="/staff" showSubline={false} />
          <p className="mt-2 font-sans text-[9px] font-semibold uppercase tracking-[0.24em] text-lightbr">
            Staff Portal
          </p>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-4">
          {NAV.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNav(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 font-sans text-sm transition-colors",
                  active
                    ? "bg-lightbr/20 text-cream"
                    : "text-cream/70 hover:bg-white/10 hover:text-cream",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-cream/10 p-4">
          <div className="mb-3 flex items-center gap-3 px-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lightbr/20 font-sans text-[10px] font-semibold text-cream">
              {getInitials(name)}
            </div>
            <p className="truncate font-sans text-sm text-cream">{name}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login?tab=staff" })}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 font-sans text-sm text-cream/70 transition-colors hover:bg-white/10 hover:text-cream"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-sand/60 bg-choc px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-cream md:hidden"
              onClick={() => setMobileNav(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.24em] text-lightbr md:hidden">
              Staff Portal
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              className="relative text-cream/80"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lightbr/20 font-sans text-[10px] font-semibold text-cream md:hidden">
              {getInitials(name)}
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-sand/60 bg-[#F7F2EC] px-2 py-2 md:hidden">
          <ul className="flex items-center justify-around">
            {NAV.map((item) => {
              const active = isNavActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center gap-0.5 px-3 py-1.5 font-sans text-[9px] uppercase tracking-wide",
                      active ? "text-choc" : "text-text-light",
                    )}
                  >
                    <item.icon className="h-5 w-5" strokeWidth={1.5} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
