"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  Package,
  Palette,
  Receipt,
  Scissors,
  Settings,
  ShoppingBag,
  TrendingUp,
  UserCircle,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { cn, getInitials } from "@/lib/utils";
import {
  canAccessLogs,
  canAccessReports,
  canAccessSettings,
  hasPermission,
  isSuperAdmin,
  roleLabel,
  type AdminPermission,
} from "@/lib/roles";
import { Logo } from "@/components/ui/Logo";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: string;
  permission?: AdminPermission;
  superAdminOnly?: boolean;
  alsoActive?: string[];
};

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Operations",
    items: [
      { href: "/admin", label: "Executive", icon: LayoutDashboard, permission: "dashboard" },
      { href: "/admin/bespoke", label: "Bespoke Pipeline", icon: Scissors, badgeKey: "bespoke", permission: "bespoke" },
      {
        href: "/admin/consultations",
        label: "Consultations",
        icon: CalendarDays,
        badgeKey: "consultations",
        permission: "consultations",
      },
      {
        href: "/admin/invoices",
        label: "Quotations & Invoices",
        icon: Receipt,
        permission: "invoices",
        alsoActive: ["/admin/quotations"],
      },
    ],
  },
  {
    label: "Shop",
    items: [
      { href: "/admin/products", label: "Products", icon: Package, permission: "shop" },
      { href: "/admin/orders", label: "Orders", icon: ShoppingBag, badgeKey: "orders", permission: "shop" },
    ],
  },
  {
    label: "Staff & HR",
    items: [
      { href: "/admin/staff", label: "Staff Members", icon: Users, permission: "staff" },
      { href: "/admin/attendance", label: "Attendance", icon: ClipboardCheck, permission: "attendance" },
      { href: "/admin/reports", label: "Performance", icon: TrendingUp, permission: "reports" },
    ],
  },
  {
    label: "Clients",
    items: [{ href: "/admin/clients", label: "Client CRM", icon: UserCircle, permission: "clients" }],
  },
  {
    label: "Finance",
    items: [
      { href: "/admin/payments", label: "Payments", icon: Wallet, permission: "finance" },
      { href: "/admin/reports", label: "Financial Reports", icon: BarChart3, permission: "reports" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/content/blog", label: "Blog / Journal", icon: FileText, permission: "content" },
      { href: "/admin/settings/content", label: "Pages", icon: FileText, permission: "settings" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/logs/activity", label: "Activity Log", icon: Activity, permission: "logs" },
      { href: "/admin/logs/errors", label: "Error Log", icon: AlertTriangle, permission: "logs" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/settings", label: "General Settings", icon: Settings, permission: "settings" },
      { href: "/admin/settings/appearance", label: "Appearance", icon: Palette, permission: "settings" },
      {
        href: "/admin/settings/developer",
        label: "Developer",
        icon: Lock,
        superAdminOnly: true,
      },
    ],
  },
];

function canSeeNavItem(
  item: NavItem,
  role: string,
  email: string | null | undefined,
): boolean {
  if (item.superAdminOnly) return isSuperAdmin(role, email);
  if (item.permission === "logs") return canAccessLogs(role, email);
  if (item.permission === "reports") return canAccessReports(role, email);
  if (item.permission === "settings") return canAccessSettings(role, email);
  if (item.permission) return hasPermission(role, item.permission);
  return true;
}

function isNavActive(pathname: string, item: NavItem): boolean {
  const paths = [item.href, ...(item.alsoActive ?? [])];
  if (item.href === "/admin") {
    return pathname === "/admin";
  }
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

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
  const email = user?.email;

  return (
    <aside
      className="flex h-screen w-[228px] shrink-0 flex-col overflow-y-auto bg-sidebar-bg text-cream"
      style={{ overscrollBehavior: "contain" }}
      aria-label="Admin navigation"
    >
      <div className="border-b border-lightbr/20 px-5 py-6">
        <Logo variant="white" size="sm" themeAdaptive={false} href="/admin" />
        <p className="mt-2 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-[rgba(152,117,91,0.5)]">
          Atelier · Operations
        </p>
      </div>

      <nav className="flex-1 px-3 py-4">
        {SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => canSeeNavItem(item, role, email));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className="mb-6">
              <p className="mb-2 px-2 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-[rgba(152,117,91,0.5)]">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isNavActive(pathname, item);
                  const badge = item.badgeKey ? badges[item.badgeKey] : 0;

                  return (
                    <li key={`${section.label}-${item.label}`}>
                      <Link
                        href={item.href}
                        onClick={() => onNavigate?.()}
                        className={cn(
                          "flex items-center gap-2.5 rounded-sm px-2 py-2 font-sans text-[11px] transition-colors",
                          active
                            ? "border-r-2 border-lightbr bg-[rgba(152,117,91,0.18)] text-cream"
                            : "text-[rgba(226,209,194,0.65)] hover:bg-lightbr/10 hover:text-cream",
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge ? (
                          <span className="rounded-full bg-nut px-1.5 py-0.5 font-sans text-[9px] font-semibold text-cream">
                            {badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-lightbr/20 p-4">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-lightbr/20 font-sans text-[11px] font-medium text-cream">
            {getInitials(displayName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-sans text-[11px] text-cream">{displayName}</p>
            <p className="mt-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-lightbr/70">
              {roleLabel(role)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/admin-login" })}
          className="mt-2 flex w-full items-center gap-2 px-2 py-2 font-sans text-[11px] text-[rgba(226,209,194,0.65)] transition-colors hover:text-cream"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
