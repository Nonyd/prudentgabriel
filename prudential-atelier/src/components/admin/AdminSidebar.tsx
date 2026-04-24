"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/common/BrandLogo";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Package,
  Scissors,
  Settings,
  ShoppingCart,
  Star,
  Tag,
  Truck,
  TrendingUp,
  UserCircle,
  Users,
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
      className="flex h-screen w-[220px] shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-[#EBEBEA] bg-[#FAFAFA]"
      style={{ overscrollBehavior: "contain" }}
      aria-label="Admin navigation"
    >
      <div className="px-5 pb-0 pt-6">
        <Link href="/admin" className="block" onClick={() => onNavigate?.()}>
          <BrandLogo width={32} height={32} variant="admin" />
        </Link>
        <p className="mt-3 font-body text-[9px] font-medium uppercase tracking-[0.2em] text-[#A8A8A4]">Prudent Gabriel</p>
      </div>

      <nav className="mt-8 flex flex-1 flex-col overflow-y-auto px-3 pb-4" style={{ overscrollBehavior: "contain" }}>
        {SECTIONS.map((section, si) => (
          <div key={section.label} className={cn(si > 0 && "mt-6")}>
            <p className="mb-1 px-2 font-body text-[9px] font-medium uppercase tracking-[0.15em] text-[#A8A8A4]">{section.label}</p>
            <ul className="space-y-0.5">
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
                        "flex items-center gap-2.5 px-2.5 py-2 font-body text-xs transition-colors duration-150 ease-out",
                        active
                          ? "bg-[#37392d] text-white"
                          : "text-[#6B6B68] hover:bg-[#F5F5F3] hover:text-black",
                      )}
                    >
                      <Icon size={15} className={cn("shrink-0", active ? "text-white" : "text-[#A8A8A4]")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-[#EBEBEA] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-[#F0F0EE] font-body text-[11px] text-black">
            {initials(user?.name, user?.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-body text-xs text-black">{displayName}</p>
            <p className="font-body text-[10px] text-[#A8A8A4]">
              {user?.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
            </p>
          </div>
        </div>
        <Link
          href="/"
          className="mt-2 flex items-center gap-1.5 font-body text-[11px] text-[#A8A8A4] transition-colors hover:text-olive"
        >
          <ArrowLeft size={12} strokeWidth={1.5} aria-hidden />
          Back to Store
        </Link>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/" })}
          className="mt-2 flex w-full items-center gap-1.5 text-left font-body text-[11px] text-[#A8A8A4] transition-colors hover:text-red-500"
        >
          <LogOut size={12} strokeWidth={1.5} aria-hidden />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
