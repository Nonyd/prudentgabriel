"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Images,
  Image as ImageIcon,
  Layout,
  LayoutDashboard,
  MessageSquare,
  Mail,
  Newspaper,
  Lock,
  LogOut,
  Package,
  Palette,
  Receipt,
  Scissors,
  Search,
  Settings,
  Share2,
  ShoppingBag,
  TrendingUp,
  Truck,
  Ticket,
  UserCircle,
  UserRoundCog,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "next-auth";
import { cn, getInitials } from "@/lib/utils";
import {
  ADMIN_NAV_JOB_PERMISSIONS,
  hasAnyPermission,
  shouldEnforceJobPermissions,
  type PermissionSession,
} from "@/lib/permissions";
import { roleLabel } from "@/lib/roles";
import { Logo } from "@/components/ui/Logo";
import {
  ADMIN_NAV_STORAGE_KEY,
  accessRuleForAdminPath,
  adminNavAccessPath,
  adminNavItemIsActive,
  adminNavSectionIdForPath,
  defaultAdminNavOpenState,
  visibleAdminNavSections,
  type AdminNavItemDef,
} from "@/lib/admin-route-access";

const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: ShoppingBag,
  quote: Truck,
  refund: AlertTriangle,
  consultations: CalendarDays,
  consultants: UserCircle,
  atelier: Scissors,
  quotations: FileText,
  invoices: Receipt,
  payments: Wallet,
  transfers: Wallet,
  reports: BarChart3,
  clients: UserCircle,
  staff: Users,
  attendance: ClipboardCheck,
  performance: TrendingUp,
  products: Package,
  collections: Layout,
  media: ImageIcon,
  import: Package,
  guide: FileText,
  coupons: Ticket,
  shipping: Truck,
  sizing: Package,
  content: Layout,
  journal: Newspaper,
  reviews: MessageSquare,
  gallery: Images,
  careers: Briefcase,
  applications: FileText,
  messages: MessageSquare,
  appearance: Palette,
  seo: Search,
  pages: FileText,
  social: Share2,
  jobs: Activity,
  "sys-emails": Mail,
  checkouts: ShoppingBag,
  logs: Activity,
  errors: AlertTriangle,
  settings: Settings,
  email: Mail,
  notifications: Mail,
  developer: Lock,
  users: UserRoundCog,
  roles: UserRoundCog,
};

function iconFor(item: AdminNavItemDef): LucideIcon {
  return NAV_ICONS[item.icon] ?? Layout;
}

function jobRoleAllowsNavItem(item: AdminNavItemDef, session: Session): boolean {
  const permissionSession: PermissionSession = {
    user: {
      role: session.user?.role,
      jobRolePermissions: session.user?.jobRolePermissions,
    },
  };
  if (!shouldEnforceJobPermissions(permissionSession)) return true;
  const path = adminNavAccessPath(item.href);
  const gate = accessRuleForAdminPath(path);
  if (!gate || gate.type !== "permission") return true;
  const lookup: string = Array.isArray(gate.permission) ? "content" : String(gate.permission);
  const jobKeys = ADMIN_NAV_JOB_PERMISSIONS[lookup];
  if (!jobKeys?.length) return true;
  return hasAnyPermission(permissionSession, jobKeys);
}

function readStoredOpen(): Record<string, boolean> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ADMIN_NAV_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, boolean>;
  } catch {
    return null;
  }
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
  const searchParams = useSearchParams();
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
      jobRolePermissions: user?.jobRolePermissions ?? session.user?.jobRolePermissions ?? [],
    },
  };

  const search = searchParams.toString();
  const [hash, setHash] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>(defaultAdminNavOpenState);

  useEffect(() => {
    const stored = readStoredOpen();
    setOpen((prev) => ({ ...prev, ...(stored ?? {}) }));
  }, []);

  useEffect(() => {
    const apply = () => setHash(window.location.hash);
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [pathname]);

  const currentSectionId = adminNavSectionIdForPath(pathname);

  useEffect(() => {
    if (!currentSectionId) return;
    setOpen((prev) => {
      if (prev[currentSectionId]) return prev;
      const next = { ...prev, [currentSectionId]: true };
      try {
        window.localStorage.setItem(ADMIN_NAV_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });
  }, [currentSectionId]);

  const jobPermsKey = (navSession.user?.jobRolePermissions ?? []).join(",");
  const email = navSession.user?.email ?? null;

  const sections = useMemo(() => {
    return visibleAdminNavSections(role, email)
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => jobRoleAllowsNavItem(item, navSession)),
      }))
      .filter((section) => section.items.length > 0);
    // navSession is rebuilt each render; jobPermsKey is the JobRole AND input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, email, jobPermsKey]);

  function toggleSection(id: string) {
    setOpen((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(ADMIN_NAV_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });
  }

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
        {sections.map((section) => {
          const expanded = open[section.id] !== false;
          const panelId = `admin-nav-${section.id}`;
          const headingId = `${panelId}-label`;

          return (
            <div key={section.id} className="mb-3">
              <button
                type="button"
                id={headingId}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggleSection(section.id)}
                className="admin-nav-section-label mb-1 flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left font-sans font-semibold uppercase text-[rgba(152,117,91,0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lightbr"
              >
                <span>{section.label}</span>
                <ChevronDown
                  className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded ? "rotate-0" : "-rotate-90")}
                  strokeWidth={1.5}
                  aria-hidden
                />
              </button>
              {expanded ? (
                <ul id={panelId} role="list" aria-labelledby={headingId} className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = adminNavItemIsActive(pathname, search, hash, item);
                    const badge = item.badgeKey ? badges[item.badgeKey] : 0;
                    const Icon = iconFor(item);

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => onNavigate?.()}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "admin-nav-item flex items-center gap-2.5 rounded-sm px-2 py-2 font-sans text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lightbr",
                            active
                              ? "border-r-2 border-lightbr bg-[rgba(152,117,91,0.18)] text-cream"
                              : "text-[rgba(226,209,194,0.65)] hover:bg-lightbr/10 hover:text-cream",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
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
              ) : null}
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
            "admin-nav-item mt-1 flex items-center gap-2 rounded-sm px-2 py-2 font-sans text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lightbr",
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
          className="admin-nav-item mt-2 flex w-full items-center gap-2 rounded-sm px-2 py-2 font-sans text-[13px] text-[rgba(226,209,194,0.65)] transition-colors hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lightbr"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
