"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import clsx from "clsx";
import type { LoyaltyTier } from "@prisma/client";
import {
  ArrowLeft,
  Calendar,
  Crown,
  Heart,
  LayoutDashboard,
  LogOut,
  Package,
  Ruler,
  Settings,
  Sparkles,
  ImageIcon,
  Users,
  ShoppingBag,
  Receipt,
} from "lucide-react";
import { TIER_LABELS } from "@/lib/loyalty";
import { Logo } from "@/components/ui/Logo";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
};

const MY_ATELIER: NavItem[] = [
  { href: "/account", label: "Dashboard", icon: LayoutDashboard },
  { href: "/account/orders", label: "My Commissions", icon: Package },
  { href: "/account/orders", label: "Ready-to-Wear", icon: ShoppingBag },
  { href: "/account/consultations", label: "Consultations", icon: Calendar },
  { href: "/account/measurements", label: "Measurements", icon: Ruler },
  { href: "/account/moodboards", label: "Moodboards", icon: ImageIcon },
];

const MY_PERKS: NavItem[] = [
  { href: "/account/loyalty", label: "Loyalty & Rewards", icon: Crown },
  { href: "/account/transactions", label: "Transactions", icon: Receipt },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/referrals", label: "Refer a Friend", icon: Users },
];

const MY_PROFILE: NavItem[] = [
  { href: "/account/style-profile", label: "Style Profile", icon: Sparkles },
  { href: "/account/settings", label: "Settings", icon: Settings },
];

const MOBILE_TABS = [
  { href: "/account", label: "Home", icon: LayoutDashboard },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/loyalty", label: "Loyalty", icon: Crown },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/settings", label: "Profile", icon: Settings },
];

const TIER_BADGE_STYLES: Record<LoyaltyTier, string> = {
  BRONZE: "border-[#CD7F32]/50 text-[#CD7F32]",
  SILVER: "border-[#A8A9AD]/50 text-[#A8A9AD]",
  GOLD: "border-lightbr/50 text-lightbr",
  PLATINUM: "border-choc/40 text-choc dark:border-cream/40 dark:text-cream",
};

function NavSection({
  title,
  items,
  pathname,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div className="mb-6">
      <p className="mb-2 px-4 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-text-light dark:text-[rgba(152,117,91,0.5)]">
        {title}
      </p>
      <div className="flex flex-col gap-0.5">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active =
            pathname === href || (href !== "/account" && pathname.startsWith(href));
          return (
            <Link
              key={`${href}-${label}`}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-4 py-2.5 font-sans text-xs font-normal transition-colors",
                active
                  ? "border-r-2 border-choc bg-[rgba(68,41,19,0.08)] text-choc dark:border-lightbr dark:bg-[rgba(152,117,91,0.18)] dark:text-cream"
                  : "text-text-mid hover:bg-[rgba(68,41,19,0.04)] hover:text-choc dark:text-cream/60 dark:hover:bg-[rgba(152,117,91,0.1)] dark:hover:text-cream",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span className="flex-1">{label}</span>
              {badge != null && badge > 0 ? (
                <span className="rounded-full bg-nut px-1.5 py-0.5 font-sans text-[10px] text-cream">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function AccountSidebar({
  name,
  tier,
  points,
  activeOrders,
  wishlistCount,
  atelierEnabled = true,
}: {
  name: string;
  tier: LoyaltyTier;
  points: number;
  activeOrders: number;
  wishlistCount: number;
  atelierEnabled?: boolean;
}) {
  const pathname = usePathname();
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const atelierNav = MY_ATELIER.filter((item) => {
    if (atelierEnabled) return true;
    if (item.label === "Dashboard") return true;
    if (item.label === "Ready-to-Wear") return true;
    return false;
  }).map((item) => (item.label === "My Commissions" ? { ...item, badge: activeOrders } : item));
  const perksNav = MY_PERKS.map((item) =>
    item.href === "/account/wishlist" ? { ...item, badge: wishlistCount } : item,
  );

  return (
    <>
      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-sand bg-ivory dark:border-sand/20 dark:bg-sidebar-bg lg:flex">
        <div className="border-b border-sand px-6 py-5 dark:border-sand/20">
          <Logo variant="dark" size="sm" themeAdaptive className="dark:hidden" />
          <Logo variant="white" size="sm" themeAdaptive={false} className="hidden dark:block" />
          {atelierEnabled ? (
            <p className="mt-1 font-sans text-[9px] uppercase tracking-[0.3em] text-text-light dark:text-lightbr/70">
              / ATELIER
            </p>
          ) : null}
        </div>

        <div className="border-b border-sand px-6 py-5 dark:border-sand/20">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-lightbr font-display text-xl text-white">
              {initials}
            </div>
            <p className="mt-3 truncate font-sans text-sm font-medium text-choc dark:text-cream">{name}</p>
            <span
              className={clsx(
                "mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.12em]",
                TIER_BADGE_STYLES[tier],
              )}
            >
              ✦ {TIER_LABELS[tier]} Member
            </span>
            <p className="mt-2 font-sans text-xs text-lightbr">{points.toLocaleString()} points</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <NavSection title="My Atelier" items={atelierNav} pathname={pathname} />
          <NavSection title="My Perks" items={perksNav} pathname={pathname} />
          <NavSection title="My Profile" items={MY_PROFILE} pathname={pathname} />
        </nav>

        <div className="space-y-1 border-t border-sand px-4 py-4 dark:border-sand/20">
          <Link
            href="/shop"
            className="flex items-center gap-2 px-2 py-2 font-sans text-[11px] text-text-mid transition-colors hover:text-nut dark:text-cream/60 dark:hover:text-cream"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            Back to shop
          </Link>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-2 px-2 py-2 font-sans text-[11px] text-text-mid transition-colors hover:text-red-600 dark:text-cream/60 dark:hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
            Logout
          </button>
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-[60px] border-t border-sand bg-ivory dark:border-sand/20 dark:bg-sidebar-bg lg:hidden">
        {MOBILE_TABS.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (href !== "/account" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-1 flex-col items-center justify-center gap-1 font-sans text-[10px]",
                active ? "text-lightbr" : "text-text-light dark:text-cream/50",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
