"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { LogOut, ShoppingBag, ShoppingCart } from "lucide-react";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import { CustomerNotificationBell } from "@/components/account/CustomerNotificationBell";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { LoyaltyTier } from "@prisma/client";

export function AccountShell({
  session,
  tier,
  points,
  activeOrders,
  wishlistCount,
  atelierEnabled = true,
  children,
}: {
  session: Session;
  tier: LoyaltyTier;
  points: number;
  activeOrders: number;
  wishlistCount: number;
  atelierEnabled?: boolean;
  children: React.ReactNode;
}) {
  const name = session.user?.name ?? "Member";

  return (
    <div className="min-h-screen bg-bg-page">
      <div className="flex min-h-screen">
        <AccountSidebar
          name={name}
          tier={tier}
          points={points}
          activeOrders={activeOrders}
          wishlistCount={wishlistCount}
          atelierEnabled={atelierEnabled}
        />
        <div className="flex min-w-0 flex-1 flex-col pb-[60px] lg:pb-0">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-sand bg-ivory px-4 dark:bg-bg-page sm:px-6 lg:static lg:h-12 lg:justify-end lg:px-6">
            <Link href="/account" className="shrink-0 lg:hidden" aria-label="Account home">
              <Logo variant="dark" size="sm" themeAdaptive className="dark:hidden" />
              <Logo variant="white" size="sm" themeAdaptive={false} className="hidden dark:block" />
            </Link>

            <div className="flex items-center gap-2 sm:gap-3 lg:gap-5">
              <CustomerNotificationBell />
              <ThemeToggle />
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/" })}
                className="inline-flex items-center gap-1.5 rounded-sm p-1.5 font-sans text-[11px] text-text-light transition-colors hover:text-red-600 sm:px-2"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
                <span className="hidden sm:inline">Logout</span>
              </button>
              <div className="hidden items-center gap-5 border-l border-sand pl-5 dark:border-sand/30 lg:flex">
                <Link
                  href="/cart"
                  className="inline-flex items-center gap-1.5 font-sans text-[11px] text-text-light transition-colors hover:text-nut"
                  aria-label="View cart"
                >
                  <ShoppingCart className="h-4 w-4" strokeWidth={1.5} />
                </Link>
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-1.5 font-sans text-[11px] text-text-light transition-colors hover:text-nut"
                >
                  <ShoppingBag className="h-4 w-4" strokeWidth={1.5} />
                  Back to shop
                </Link>
              </div>
            </div>
          </header>
          <main className="flex-1 bg-bg px-4 py-6 sm:px-6 lg:px-10 lg:py-8 dark:bg-bg-page">{children}</main>
        </div>
      </div>
    </div>
  );
}
