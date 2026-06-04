"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { LoyaltyTier } from "@prisma/client";
import {
  Calendar,
  Crown,
  Heart,
  LayoutDashboard,
  Package,
  Ruler,
  Settings,
  Sparkles,
  ImageIcon,
  Users,
  User,
} from "lucide-react";
import { TIER_LABELS } from "@/lib/loyalty";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
};

const MY_ACCOUNT: NavItem[] = [
  { href: "/account", label: "Dashboard", icon: LayoutDashboard },
  { href: "/account/orders", label: "My Orders", icon: Package },
  { href: "/account/measurements", label: "Measurements", icon: Ruler },
  { href: "/account/moodboards", label: "Moodboards", icon: ImageIcon },
  { href: "/account/consultations", label: "Consultations", icon: Calendar },
];

const PERKS: NavItem[] = [
  { href: "/account/loyalty", label: "Loyalty & Rewards", icon: Crown },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/referrals", label: "Refer a Friend", icon: Users },
];

const PREFS: NavItem[] = [
  { href: "/account/style-profile", label: "Style Profile", icon: Sparkles },
  { href: "/account/settings", label: "Settings", icon: Settings },
];

const MOBILE_TABS = [
  { href: "/account", label: "Home", icon: LayoutDashboard },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/loyalty", label: "Loyalty", icon: Crown },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/settings", label: "Account", icon: User },
];

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
      <p className="mb-2 px-4 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-lightbr/70">
        {title}
      </p>
      <div className="flex flex-col gap-0.5">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active =
            pathname === href || (href !== "/account" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-4 py-2.5 font-sans text-[13px] transition-colors",
                active
                  ? "border-r-2 border-lightbr bg-[rgba(152,117,91,0.18)] text-cream"
                  : "text-cream/60 hover:bg-[rgba(152,117,91,0.1)] hover:text-cream",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
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
  activeOrders,
  wishlistCount,
}: {
  name: string;
  tier: LoyaltyTier;
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

  const accountNav = MY_ACCOUNT.map((item) =>
    item.href === "/account/orders" ? { ...item, badge: activeOrders } : item,
  );
  const perksNav = PERKS.map((item) =>
    item.href === "/account/wishlist" ? { ...item, badge: wishlistCount } : item,
  );

  return (
    <>
      <aside className="hidden w-[220px] shrink-0 flex-col bg-choc lg:flex">
        <div className="border-b border-sand/20 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-lightbr font-display text-lg text-cream">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate font-sans text-sm font-medium text-cream">{name}</p>
              <span className="mt-1 inline-block rounded-sm border border-lightbr/40 px-2 py-0.5 font-sans text-[10px] uppercase tracking-wider text-lightbr">
                {TIER_LABELS[tier]}
              </span>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <NavSection title="My Account" items={accountNav} pathname={pathname} />
          <NavSection title="Perks" items={perksNav} pathname={pathname} />
          <NavSection title="Preferences" items={PREFS} pathname={pathname} />
        </nav>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-sand bg-choc lg:hidden">
        {MOBILE_TABS.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (href !== "/account" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-1 flex-col items-center gap-1 py-2 font-sans text-[10px]",
                active ? "text-cream" : "text-cream/50",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
