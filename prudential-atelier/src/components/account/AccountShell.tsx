"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { LogOut, ShoppingBag, ShoppingCart } from "lucide-react";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { LoyaltyTier } from "@prisma/client";

export function AccountShell({
  session,
  tier,
  points,
  activeOrders,
  wishlistCount,
  children,
}: {
  session: Session;
  tier: LoyaltyTier;
  points: number;
  activeOrders: number;
  wishlistCount: number;
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
        />
        <div className="flex min-w-0 flex-1 flex-col pb-[60px] lg:pb-0">
          <header className="hidden h-12 shrink-0 items-center justify-end gap-5 border-b border-sand bg-ivory px-6 dark:bg-bg-page lg:flex">
            <ThemeToggle />
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
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/" })}
              className="inline-flex items-center gap-1.5 font-sans text-[11px] text-text-light transition-colors hover:text-red-600"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
              Logout
            </button>
          </header>
          <main className="flex-1 bg-bg px-4 py-6 sm:px-6 lg:px-10 lg:py-8 dark:bg-bg-page">{children}</main>
        </div>
      </div>
    </div>
  );
}
