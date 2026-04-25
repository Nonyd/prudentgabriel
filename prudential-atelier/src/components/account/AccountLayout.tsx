"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { useState } from "react";
import {
  Calendar,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  ShoppingBag,
  User,
  Users,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import { CustomerProfileDrawer } from "@/components/account/CustomerProfileDrawer";
import { DarkModeToggle } from "@/components/common/DarkModeToggle";

const NAV = [
  { href: "/account", label: "Overview", icon: LayoutDashboard },
  { href: "/account/orders", label: "My Orders", icon: Package },
  { href: "/account/consultations", label: "Consultations", icon: Calendar },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/wallet", label: "Wallet & Points", icon: Wallet },
  { href: "/account/referral", label: "Referral", icon: Users },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/profile", label: "Profile", icon: User },
];

export function AccountLayout({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const name = session.user?.name ?? "Member";
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const role = session.user?.role;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const pts = session.user?.pointsBalance ?? 0;
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-ivory">
      <aside
        className="hidden h-screen w-[260px] shrink-0 flex-col overflow-y-auto overflow-x-hidden bg-charcoal text-ivory lg:flex"
        style={{ overscrollBehavior: "contain" }}
      >
        <div className="border-b border-charcoal-mid p-6">
          <div className="flex items-center gap-3">
            {session.user?.image ? (
              <Image
                src={session.user.image}
                alt=""
                width={48}
                height={48}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-olive font-display text-lg text-white">
                {initials}
              </div>
            )}
            <div>
              <p className="font-body text-sm font-medium text-ivory">{name}</p>
              {isAdmin && (
                <span className="mt-0.5 inline-block rounded-sm bg-gold/20 px-2 py-0.5 font-label text-[10px] text-gold">
                  Admin
                </span>
              )}
              <p className="font-label text-[11px] text-gold">{pts} pts</p>
            </div>
          </div>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-4" style={{ overscrollBehavior: "contain" }}>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/account" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-3 rounded-sm px-4 py-2.5 text-sm transition-colors",
                  active ? "bg-olive text-white" : "text-ivory/60 hover:bg-charcoal-mid hover:text-ivory",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
          <div className="my-2 border-t border-charcoal-mid" />
          <Link
            href="/shop"
            className="flex items-center gap-3 rounded-sm px-4 py-2.5 text-sm text-ivory/60 hover:bg-charcoal-mid hover:text-ivory"
          >
            <ShoppingBag className="h-4 w-4" />
            Back to Shop
          </Link>
        </nav>
        <div className="p-4">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center justify-center gap-2 rounded-sm border border-charcoal-mid py-2 text-sm text-ivory/60 hover:bg-red-50 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-ivory px-4 py-3">
          <div className="flex items-center gap-3 lg:hidden">
            <button type="button" onClick={() => router.back()} className="text-charcoal" aria-label="Back">
              ←
            </button>
            <span className="font-display text-lg text-olive">Account</span>
          </div>
          <div className="hidden lg:block" />
          <div className="ml-auto flex items-center gap-3">
            <DarkModeToggle />
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-2"
            >
              {session.user?.image ? (
                <Image src={session.user.image} alt="" width={32} height={32} className="rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6B1C2A] font-body text-[11px] font-medium text-white">
                  {initials}
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="inline-flex items-center gap-1 font-body text-[12px] text-[#6B6B68] hover:text-red-600"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-8 lg:px-10 lg:py-10">{children}</main>
        <CustomerProfileDrawer
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          name={name}
          email={session.user?.email ?? ""}
          pointsBalance={pts}
        />
      </div>
    </div>
  );
}
