"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Images,
  Image as ImageIcon,
  Layout,
  LayoutDashboard,
  MessageSquare,
  Mail,
  Send,
  Newspaper,
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
  UserRoundCog,
  Users,
  Wallet,
  Truck,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { Session } from "next-auth";
import { cn, getInitials } from "@/lib/utils";
import {
  ADMIN_NAV_JOB_PERMISSIONS,
  hasAnyPermission,
  shouldEnforceJobPermissions,
  type PermissionSession,
} from "@/lib/permissions";
import {
  canAccessLogs,
  canAccessReports,
  canAccessSettings,
  hasPermission as hasRolePermission,
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
  generalAdminOnly?: boolean;
  alsoActive?: string[];
};

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Operations",
    items: [
      { href: "/admin", label: "Executive", icon: LayoutDashboard, permission: "dashboard" },
      { href: "/admin/bespoke", label: "Atelier Pipeline", icon: Scissors, badgeKey: "bespoke", permission: "bespoke" },
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
        alsoActive: ["/admin/quotations", "/admin/invoices/quotations"],
      },
    ],
  },
  {
    label: "Shop",
    items: [
      { href: "/admin/products", label: "Products", icon: Package, permission: "shop" },
      { href: "/admin/sizing", label: "Sizing", icon: Package, permission: "shop" },
      { href: "/admin/products/guide", label: "How to upload", icon: Package, permission: "shop" },
      { href: "/admin/shop/import", label: "Import Products", icon: Package, permission: "shop" },
      { href: "/admin/collections", label: "Collections", icon: Package, permission: "shop" },
      { href: "/admin/orders", label: "Orders", icon: ShoppingBag, badgeKey: "orders", permission: "shop" },
      { href: "/admin/checkouts", label: "Abandoned checkouts", icon: ShoppingBag, permission: "shop" },
      { href: "/admin/shipping", label: "Shipping", icon: Truck, permission: "shop" },
      { href: "/admin/coupons", label: "Coupons", icon: Ticket, permission: "shop" },
    ],
  },
  {
    label: "Staff & HR",
    items: [
      { href: "/admin/staff", label: "Staff Members", icon: Users, permission: "staff" },
      { href: "/admin/attendance", label: "Attendance", icon: ClipboardCheck, permission: "attendance" },
      { href: "/admin/staff/performance", label: "Performance", icon: TrendingUp, permission: "reports" },
    ],
  },
  {
    label: "Careers",
    items: [
      {
        href: "/admin/careers",
        label: "Job Postings",
        icon: Briefcase,
        generalAdminOnly: true,
        alsoActive: ["/admin/careers/new"],
      },
      {
        href: "/admin/careers/applications",
        label: "Applications",
        icon: FileText,
        generalAdminOnly: true,
      },
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
      { href: "/admin/settings/bank-accounts", label: "Bank accounts", icon: Wallet, permission: "settings" },
      { href: "/admin/reports", label: "Financial Reports", icon: BarChart3, permission: "reports" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/content", label: "Overview", icon: Layout, permission: "content", alsoActive: ["/admin/content/pages", "/admin/content/media"] },
      { href: "/admin/content/messages", label: "Messages", icon: MessageSquare, generalAdminOnly: true, badgeKey: "messages" },
      { href: "/admin/content/email-templates", label: "Email Templates", icon: Mail, generalAdminOnly: true },
      { href: "/admin/content/send-email", label: "Send Email", icon: Send, generalAdminOnly: true },
      { href: "/admin/content/unsubscribes", label: "Unsubscribes", icon: Mail, generalAdminOnly: true },
      { href: "/admin/content/pages", label: "Page content", icon: FileText, permission: "content" },
      { href: "/admin/content/blog", label: "Blog / Journal", icon: Newspaper, permission: "content" },
      { href: "/admin/reviews", label: "Reviews", icon: MessageSquare, permission: "content" },
      { href: "/admin/gallery", label: "Portfolio gallery", icon: Images, permission: "content" },
      { href: "/admin/content/media", label: "Media library", icon: ImageIcon, permission: "content" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/system/jobs", label: "Scheduled jobs", icon: Activity, generalAdminOnly: true },
      { href: "/admin/system/emails", label: "Emails", icon: Mail, generalAdminOnly: true },
      { href: "/admin/logs/activity", label: "Activity Log", icon: Activity, permission: "logs" },
      { href: "/admin/logs/errors", label: "Error Log", icon: AlertTriangle, permission: "logs" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/settings", label: "General Settings", icon: Settings, permission: "settings" },
      { href: "/admin/settings/appearance", label: "Brand & appearance", icon: Palette, permission: "settings" },
      {
        href: "/admin/settings/developer",
        label: "Developer",
        icon: Lock,
        superAdminOnly: true,
      },
      {
        href: "/admin/settings/users",
        label: "Users & Roles",
        icon: UserRoundCog,
        superAdminOnly: true,
      },
      {
        href: "/admin/settings/roles",
        label: "Job Roles",
        icon: UserRoundCog,
        generalAdminOnly: true,
      },
    ],
  },
];

function canSeeNavItem(
  item: NavItem,
  session: Session,
): boolean {
  const role = session.user?.role ?? "ADMIN";
  const email = session.user?.email;
  const permissionSession: PermissionSession = {
    user: {
      role: session.user?.role,
      jobRolePermissions: session.user?.jobRolePermissions,
    },
  };

  if (item.superAdminOnly) return isSuperAdmin(role, email);
  if (item.generalAdminOnly) return role === "ADMIN" || isSuperAdmin(role, email);

  let legacyAllowed = true;
  if (item.permission === "logs") legacyAllowed = canAccessLogs(role, email);
  else if (item.permission === "reports") legacyAllowed = canAccessReports(role, email);
  else if (item.permission === "settings") legacyAllowed = canAccessSettings(role, email);
  else if (item.permission) legacyAllowed = hasRolePermission(role, item.permission);

  if (!legacyAllowed) return false;

  if (!shouldEnforceJobPermissions(permissionSession) || !item.permission) return true;

  const jobKeys = ADMIN_NAV_JOB_PERMISSIONS[item.permission];
  if (!jobKeys?.length) return true;

  return hasAnyPermission(permissionSession, jobKeys);
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
  const { data: liveSession } = useSession();
  const user = liveSession?.user ?? session.user;
  const displayName = user?.name ?? user?.email ?? "Admin";
  const avatarUrl = user?.image;
  const role = user?.role ?? session.user?.role ?? "ADMIN";
  const navSession: Session = {
    ...session,
    user: {
      ...session.user,
      ...user,
      role,
      jobRolePermissions:
        user?.jobRolePermissions ?? session.user?.jobRolePermissions ?? [],
    },
  };

  return (
    <aside
      className="flex h-screen w-[228px] shrink-0 flex-col overflow-hidden bg-sidebar-bg text-cream"
      style={{ overscrollBehavior: "contain" }}
      aria-label="Admin navigation"
    >
      <div className="border-b border-lightbr/20 px-5 py-6">
        <Logo variant="white" size="sm" themeAdaptive={false} href="/admin" />
        <p className="mt-2 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-[rgba(152,117,91,0.5)]">
          Atelier · Operations
        </p>
      </div>

      <nav className="admin-sidebar-nav min-h-0 flex-1 px-3 py-4">
        {SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => canSeeNavItem(item, navSession));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className="mb-6">
              <p className="admin-nav-section-label mb-2 px-2 font-sans font-semibold uppercase text-[rgba(152,117,91,0.5)]">
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
                          "admin-nav-item flex items-center gap-2.5 rounded-sm px-2 py-2 font-sans text-[13px] transition-colors",
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
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-lightbr/20 font-sans text-[11px] font-medium text-cream">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              getInitials(displayName)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-sans text-[13px] text-cream">{displayName}</p>
            <p className="mt-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-lightbr/70">
              {roleLabel(role)}
            </p>
          </div>
        </div>
        <Link
          href="/admin/account-settings"
          onClick={() => onNavigate?.()}
          className={cn(
            "admin-nav-item mt-1 flex items-center gap-2 rounded-sm px-2 py-2 font-sans text-[13px] transition-colors",
            pathname.startsWith("/admin/account-settings")
              ? "border-r-2 border-lightbr bg-[rgba(152,117,91,0.18)] text-cream"
              : "text-[rgba(226,209,194,0.65)] hover:bg-lightbr/10 hover:text-cream",
          )}
        >
          <UserRoundCog className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          Account Settings
        </Link>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/login?tab=admin" })}
          className="admin-nav-item mt-2 flex w-full items-center gap-2 px-2 py-2 font-sans text-[13px] text-[rgba(226,209,194,0.65)] transition-colors hover:text-cream"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
