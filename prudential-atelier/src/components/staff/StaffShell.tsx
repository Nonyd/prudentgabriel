"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { Bell, ClipboardList, Clock, Home, LogOut, User } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { cn, getInitials } from "@/lib/utils";

const NAV = [
  { href: "/staff", label: "Home", icon: Home },
  { href: "/staff/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/staff/time", label: "Time", icon: Clock },
  { href: "/staff/profile", label: "Profile", icon: User },
];

export function StaffShell({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const name = session.user?.name ?? session.user?.email ?? "Staff";

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sand/60 bg-choc px-4 py-3">
        <div className="flex items-center gap-3">
          <Logo variant="white" size="sm" themeAdaptive={false} href="/staff" showSubline={false} />
          <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.24em] text-lightbr">
            Staff Portal
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="relative text-cream/80"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lightbr/20 font-sans text-[10px] font-semibold text-cream">
            {getInitials(name)}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-sand/60 bg-[#F7F2EC] px-2 py-2">
        <ul className="mx-auto flex max-w-lg items-center justify-around">
          {NAV.map((item) => {
            const active =
              item.href === "/staff"
                ? pathname === "/staff"
                : pathname.startsWith(item.href);
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

      <button
        type="button"
        onClick={() => void signOut({ callbackUrl: "/login?tab=staff" })}
        className="sr-only"
        aria-hidden
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
