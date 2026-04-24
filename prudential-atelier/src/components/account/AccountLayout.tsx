"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import {
  Calendar,
  ChevronRight,
  Heart,
  LayoutDashboard,
  MapPin,
  Package,
  Settings,
  ShoppingBag,
  User,
  Users,
  Wallet,
} from "lucide-react";
import clsx from "clsx";

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

  return (
    <div className="flex min-h-screen bg-ivory">
      <aside className="hidden w-[260px] shrink-0 flex-col bg-charcoal text-ivory lg:flex">
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
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-wine font-display text-lg text-gold">
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
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/account" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-3 rounded-sm px-4 py-2.5 text-sm transition-colors",
                  active ? "bg-wine text-ivory" : "text-ivory/60 hover:bg-charcoal-mid hover:text-ivory",
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
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-sm px-4 py-2.5 text-sm text-ivory/60 hover:bg-charcoal-mid hover:text-ivory"
            >
              <Settings className="h-4 w-4" />
              Admin Panel
            </Link>
          )}
        </nav>
        <div className="p-4">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center justify-center gap-2 rounded-sm py-2 text-sm text-ivory/60 hover:text-ivory"
          >
            Sign out
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-ivory px-4 py-3 lg:hidden">
          <button type="button" onClick={() => router.back()} className="text-charcoal" aria-label="Back">
            ←
          </button>
          <span className="font-display text-lg text-wine">Account</span>
        </header>
        <main className="flex-1 px-5 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
