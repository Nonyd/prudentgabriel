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
  { href: "/account/loyalty", label: "Prudent Points", icon: Crown },
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
  { href: "/account/loyalty", label: "Prudent Points", icon: Crown },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/settings", label: "Profile", icon: Settings },
];

const TIER_BADGE_STYLES: Record<LoyaltyTier, string> = {
  BRONZE: "border-[#E0A070] text-[#E0A070]",
  SILVER: "border-[#D8D8DC] text-[#D8D8DC]",
  GOLD: "border-[#C9A84C] text-[#E8C96A]",
  PLATINUM: "border-[#F0E6DC] text-[#F7F2EC]",
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
    <div className="mb-7">
      <p className="account-rail-label mb-2 px-4 font-sans uppercase">{title}</p>
      <div className="flex flex-col gap-0.5">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active =
            pathname === href || (href !== "/account" && pathname.startsWith(href));
          return (
            <Link
              key={`${href}-${label}`}
              href={href}
              className={clsx(
                "account-rail-link flex items-center gap-3 px-4 py-2.5 font-sans transition-colors duration-150",
                active && "account-rail-link-active",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="flex-1 tracking-wide">{label}</span>
              {badge != null && badge > 0 ? (
                <span className="rounded-full bg-[#c9a84c] px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[#442913]">
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
}: {
  name: string;
  tier: LoyaltyTier;
  points: number;
  activeOrders: number;
  wishlistCount: number;
}) {
  const pathname = usePathname();
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const atelierNav = MY_ATELIER.map((item) =>
    item.label === "My Commissions" ? { ...item, badge: activeOrders } : item,
  );
  const perksNav = MY_PERKS.map((item) =>
    item.href === "/account/wishlist" ? { ...item, badge: wishlistCount } : item,
  );

  return (
    <>
      <aside className="account-rail hidden h-screen w-[248px] shrink-0 flex-col lg:flex">
        <div className="border-b border-[var(--glass-edge)] px-6 py-5">
          <Logo variant="dark" size="sm" themeAdaptive={false} />
          <p className="mt-2 font-sans text-[13px] font-normal text-text-mid">
            Atelier
          </p>
        </div>

        <div className="border-b border-[var(--glass-edge)] px-6 py-6">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#c9a84c] font-display text-xl text-[#442913]">
              {initials}
            </div>
            <p className="mt-3 truncate font-display text-lg text-choc">{name}</p>
            <span
              className={clsx(
                "mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.12em]",
                TIER_BADGE_STYLES[tier],
              )}
            >
              ✦ {TIER_LABELS[tier]} Member
            </span>
            <p className="mt-2 font-sans text-xs font-medium text-text-mid">
              {points.toLocaleString()} points
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <NavSection title="My Atelier" items={atelierNav} pathname={pathname} />
          <NavSection title="My Perks" items={perksNav} pathname={pathname} />
          <NavSection title="My Profile" items={MY_PROFILE} pathname={pathname} />
        </nav>

        <div className="space-y-1 border-t border-[var(--glass-edge)] px-4 py-4">
          <Link
            href="/rtw"
            className="flex items-center gap-2 px-2 py-2 font-sans text-[12px] font-medium text-text-mid transition-colors hover:text-choc"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            Back to shop
          </Link>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-2 px-2 py-2 font-sans text-[12px] font-medium text-text-mid transition-colors hover:text-choc"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
            Logout
          </button>
        </div>
      </aside>

      <nav className="account-rail fixed bottom-0 left-0 right-0 z-40 flex h-[60px] border-t border-[var(--glass-edge)] lg:hidden">
        {MOBILE_TABS.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (href !== "/account" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-1 flex-col items-center justify-center gap-1 font-sans text-[10px] font-medium",
                active ? "text-choc" : "text-text-mid",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
