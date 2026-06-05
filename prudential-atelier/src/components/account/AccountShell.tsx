"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { LogOut, ShoppingBag } from "lucide-react";
import { Navbar } from "@/components/public/Navbar";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { LoyaltyTier } from "@prisma/client";

export function AccountShell({
  session,
  tier,
  activeOrders,
  wishlistCount,
  children,
}: {
  session: Session;
  tier: LoyaltyTier;
  activeOrders: number;
  wishlistCount: number;
  children: React.ReactNode;
}) {
  const name = session.user?.name ?? "Member";

  return (
    <div className="min-h-screen bg-bg-page">
      <Navbar />
      <div className="flex min-h-[calc(100vh-64px)]">
        <AccountSidebar
          name={name}
          tier={tier}
          activeOrders={activeOrders}
          wishlistCount={wishlistCount}
        />
        <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
          <div className="hidden items-center justify-end gap-4 border-b border-sand/70 bg-white px-6 py-3 lg:flex">
            <ThemeToggle />
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 font-sans text-xs text-text-mid hover:text-nut"
            >
              <ShoppingBag className="h-4 w-4" />
              Back to shop
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="inline-flex items-center gap-2 font-sans text-xs text-text-mid hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
          <main className="flex-1 bg-bg-page px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
