"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Scissors,
  Settings,
  ShoppingBag,
  UserCircle,
  Users,
  Wallet,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { isSuperAdmin } from "@/lib/roles";

type NavItem = { href: string; label: string; icon: LucideIcon; badgeKey?: string };

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/bespoke", label: "Orders Pipeline", icon: Scissors, badgeKey: "bespoke" },
      { href: "/admin/consultations", label: "Consultations", icon: CalendarDays, badgeKey: "consultations" },
      { href: "/admin/invoices", label: "Invoices", icon: Receipt },
      { href: "/admin/quotations", label: "Quotations", icon: FileText },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/admin/products", label: "RTW Products", icon: Package },
      { href: "/admin/orders", label: "RTW Orders", icon: ShoppingBag, badgeKey: "orders" },
      { href: "/admin/payments", label: "Payments", icon: Wallet, badgeKey: "payments" },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/admin/clients", label: "Clients", icon: UserCircle },
      { href: "/admin/staff", label: "Staff", icon: Users },
      { href: "/admin/attendance", label: "Attendance", icon: ClipboardCheck },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/admin/payments", label: "Finance", icon: Wallet },
      { href: "/admin/reports", label: "Reports", icon: Activity },
    ],
  },
  {
    label: "Content",
    items: [{ href: "/admin/content/blog", label: "Blog", icon: FileText }],
  },
  {
    label: "System",
    items: [
      { href: "/admin/logs/activity", label: "Activity Logs", icon: Activity },
      { href: "/admin/logs/errors", label: "Error Logs", icon: AlertTriangle },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AdminSidebar({
  session,
  onNavigate,
  badges = {},
}: {
  session: Session;
  onNavigate?: () => void;
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const user = session.user;
  const displayName = user?.name ?? user?.email ?? "Admin";
  const role = user?.role ?? "ADMIN";
  const showDeveloper = isSuperAdmin(role, user?.email);

  return (
    <aside
      className="flex h-screen w-[228px] shrink-0 flex-col overflow-y-auto bg-choc text-cream"
      style={{ overscrollBehavior: "contain" }}
      aria-label="Admin navigation"
    >
      <div className="border-b border-lightbr/20 px-5 py-6">
        <Link href="/admin" onClick={() => onNavigate?.()} className="block">
          <p className="font-serif text-lg font-medium tracking-[0.12em]">
            <span className="text-cream">Prudent</span>{" "}
            <span className="text-lightbr">Gabriel</span>
          </p>
          <p className="mt-1 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-lightbr/60">
            Operations Suite
          </p>
        </Link>
      </div>

      <div className="flex items-center gap-3 border-b border-lightbr/20 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-lightbr/20 font-sans text-[11px] font-medium text-cream">
          {getInitials(displayName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-sans text-[11px] text-cream">{displayName}</p>
          <p className="mt-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-lightbr/70">
            {role.replace(/_/g, " ")}
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        {SECTIONS.map((section) => (
          <div key={section.label} className="mb-6">
            <p className="mb-2 px-2 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-lightbr/50">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const badge = item.badgeKey ? badges[item.badgeKey] : 0;

                return (
                  <li key={`${section.label}-${item.label}`}>
                    <Link
                      href={item.href}
                      onClick={() => onNavigate?.()}
                      className={cn(
                        "flex items-center gap-2.5 rounded-sm px-2 py-2 font-sans text-[11px] transition-colors",
                        active
                          ? "border-r-2 border-lightbr bg-lightbr/18 text-cream"
                          : "text-cream/65 hover:bg-lightbr/10 hover:text-cream",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge ? (
                        <span className="rounded-sm bg-nut px-1.5 py-0.5 font-sans text-[9px] font-semibold text-cream">
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {showDeveloper ? (
          <div className="mb-6">
            <p className="mb-2 px-2 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-lightbr/50">
              Developer
            </p>
            <Link
              href="/admin/settings/developer"
              onClick={() => onNavigate?.()}
              className={cn(
                "flex items-center gap-2.5 rounded-sm px-2 py-2 font-sans text-[11px] transition-colors",
                pathname.startsWith("/admin/settings/developer")
                  ? "border-r-2 border-lightbr bg-lightbr/18 text-cream"
                  : "text-cream/65 hover:bg-lightbr/10 hover:text-cream",
              )}
            >
              <Settings className="h-4 w-4" strokeWidth={1.5} />
              Developer
            </Link>
          </div>
        ) : null}
      </nav>

      <div className="border-t border-lightbr/20 p-4">
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/admin-login" })}
          className="flex w-full items-center gap-2 px-2 py-2 font-sans text-[11px] text-cream/65 transition-colors hover:text-cream"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
