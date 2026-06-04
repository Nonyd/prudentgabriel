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
          <div className="hidden items-center justify-end gap-3 border-b border-sand bg-ivory px-6 py-2 lg:flex">
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
          <main className="flex-1 px-5 py-8 lg:px-10 lg:py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
