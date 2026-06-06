"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { Session } from "next-auth";
import { useState } from "react";
import { ClipboardList, Clock, Home, LogOut, Settings, UserRoundCog } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { StaffTopbar } from "@/components/staff/StaffTopbar";
import { cn, getInitials } from "@/lib/utils";

const NAV = [
  { href: "/staff", label: "Home", icon: Home },
  { href: "/staff/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/staff/time", label: "Time", icon: Clock },
  { href: "/staff/settings", label: "Settings", icon: Settings },
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
  const { data: liveSession } = useSession();
  const user = liveSession?.user ?? session.user;
  const name = user?.name ?? user?.email ?? "Staff";
  const avatarUrl = user?.image ?? "";
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-bg-page">
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
          "fixed inset-y-0 left-0 z-50 flex w-[240px] shrink-0 flex-col border-r border-lightbr/20 bg-sidebar-bg transition-transform duration-200 md:static md:z-0 md:translate-x-0",
          mobileNav ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="border-b border-lightbr/20 p-5">
          <Logo variant="white" size="sm" themeAdaptive={false} href="/staff" showSubline={false} />
          <p className="mt-2 font-sans text-[9px] font-semibold uppercase tracking-[0.24em] text-lightbr/80">
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
                  "flex items-center gap-3 rounded-sm px-3 py-2.5 font-sans text-[13px] transition-colors",
                  active
                    ? "border-r-2 border-lightbr bg-[rgba(152,117,91,0.18)] text-cream"
                    : "text-[rgba(226,209,194,0.65)] hover:bg-lightbr/10 hover:text-cream",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-lightbr/20 p-4">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-lightbr/20 font-sans text-[11px] font-medium text-cream">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                getInitials(name)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-sans text-[13px] text-cream">{name}</p>
              <p className="mt-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-lightbr/70">
                Staff
              </p>
            </div>
          </div>
          <Link
            href="/staff/settings"
            onClick={() => setMobileNav(false)}
            className={cn(
              "mt-1 flex items-center gap-2 rounded-sm px-2 py-2 font-sans text-[13px] transition-colors",
              pathname.startsWith("/staff/settings")
                ? "border-r-2 border-lightbr bg-[rgba(152,117,91,0.18)] text-cream"
                : "text-[rgba(226,209,194,0.65)] hover:bg-lightbr/10 hover:text-cream",
            )}
          >
            <UserRoundCog className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            Account Settings
          </Link>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login?tab=staff" })}
            className="mt-2 flex w-full items-center gap-2 px-2 py-2 font-sans text-[13px] text-[rgba(226,209,194,0.65)] transition-colors hover:text-cream"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <StaffTopbar onOpenNav={() => setMobileNav(true)} />

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-sand bg-ivory px-2 py-2 md:hidden">
          <ul className="flex items-center justify-around">
            {NAV.map((item) => {
              const active = isNavActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center gap-0.5 px-3 py-1.5 font-sans text-[9px] uppercase tracking-wide",
                      active ? "text-choc" : "text-text-mid",
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
