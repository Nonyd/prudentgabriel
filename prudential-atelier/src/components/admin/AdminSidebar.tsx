"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  UserCircle,
  LayoutDashboard,
  Package,
  Scissors,
  Star,
  ShoppingCart,
  Tag,
  Truck,
  Users,
  TrendingUp,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS: {
  label: string;
  items: { href: string; label: string; icon: LucideIcon }[];
}[] = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/bespoke", label: "Bespoke Requests", icon: Scissors },
      { href: "/admin/consultations", label: "Consultations", icon: CalendarDays },
      { href: "/admin/consultants", label: "Consultants", icon: UserCircle },
      { href: "/admin/reviews", label: "Reviews", icon: Star },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
      { href: "/admin/coupons", label: "Coupons", icon: Tag },
      { href: "/admin/shipping", label: "Shipping Zones", icon: Truck },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/admin/customers", label: "All Customers", icon: Users },
      { href: "/admin/referrals", label: "Referral Analytics", icon: TrendingUp },
    ],
  },
  {
    label: "System",
    items: [{ href: "/admin/settings", label: "Settings", icon: Settings }],
  },
];

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  const e = (email ?? "").split("@")[0] ?? "";
  return e.slice(0, 2).toUpperCase() || "AD";
}

export function AdminSidebar({ session, onNavigate }: { session: Session; onNavigate?: () => void }) {
  const pathname = usePathname();
  const user = session.user;
  const displayName = user?.name ?? user?.email ?? "Admin";

  return (
    <aside
      className="flex h-full w-[240px] shrink-0 flex-col overflow-y-auto border-r border-[rgba(201,168,76,0.15)] bg-[#1A1A1A]"
      aria-label="Admin navigation"
    >
      <div className="px-4 pt-6">
        <Link href="/admin" className="block text-center font-display text-lg font-medium tracking-wide text-white">
          Prudential Atelier
        </Link>
        <div className="mx-auto mt-4 h-px w-12 bg-gold/40" />
      </div>

      <nav className="mt-6 flex-1 px-3 pb-6">
        {SECTIONS.map((section, si) => (
          <div key={section.label} className={cn(si > 0 && "mt-6")}>
            <p className="px-3 font-label text-[10px] font-normal uppercase tracking-[0.2em] text-gold/40">
              {section.label}
            </p>
            <ul className="mt-2 space-y-0.5">
              {section.items.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => onNavigate?.()}
                      className={cn(
                        "flex items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] text-[#8A8A8A] transition-colors",
                        "hover:bg-[#252525] hover:text-ivory/80",
                        active &&
                          "border-l-2 border-olive bg-olive/15 pl-[10px] text-olive hover:text-olive",
                        !active && "border-l-2 border-transparent",
                      )}
                    >
                      <Icon size={16} className="shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-gold/10 px-3 pb-6 pt-4">
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-olive text-xs font-medium text-white">
            {initials(user?.name, user?.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ivory/90">{displayName}</p>
            <span className="inline-block bg-olive/25 px-1.5 py-0.5 font-body text-[9px] font-medium uppercase tracking-wide text-bride-accent">
              {user?.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
            </span>
          </div>
        </div>
        <Link
          href="/"
          className="mt-4 block px-1 text-[13px] text-[#8A8A8A] transition-colors hover:text-gold"
        >
          ← Back to Store
        </Link>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/" })}
          className="mt-2 flex w-full items-center gap-2 px-1 text-left text-[13px] text-[#8A8A8A] transition-colors hover:text-red-400"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
