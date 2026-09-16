"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/store", label: "Morning" },
  { href: "/admin/store/items", label: "Catalogue" },
  { href: "/admin/store/book", label: "Issue book" },
  { href: "/admin/store/opening", label: "Opening count" },
] as const;

export function StoreSubnav() {
  const path = usePathname();
  return (
    <nav className="flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const active = path === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-[3px] border px-3 py-1.5 font-sans text-[11px] font-medium uppercase tracking-[0.12em]",
              active
                ? "border-nut bg-nut/10 text-choc"
                : "border-sand text-text-mid hover:border-nut hover:text-choc",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const STORE_FIELD =
  "w-full rounded-[3px] border border-sand bg-bg-card px-3 py-2 font-sans text-sm text-ink outline-none focus:border-nut";
