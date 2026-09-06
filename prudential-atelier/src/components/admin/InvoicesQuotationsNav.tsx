"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/invoices", label: "Invoices" },
  { href: "/admin/quotations", label: "Quotations" },
] as const;

function isQuotationsPath(pathname: string): boolean {
  return (
    pathname === "/admin/quotations" ||
    pathname.startsWith("/admin/quotations/") ||
    pathname.startsWith("/admin/invoices/quotations")
  );
}

export function InvoicesQuotationsNav() {
  const pathname = usePathname();
  const onQuotations = isQuotationsPath(pathname);

  return (
    <nav
      className="mt-4 inline-flex glass-1 glass-pill p-1"
      aria-label="Invoices and quotations"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === "/admin/quotations" ? onQuotations : !onQuotations && pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-full px-4 py-2 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors",
              active
                ? "bg-[var(--choc-deep)] text-[var(--ivory-deep)]"
                : "text-text-mid hover:text-text-primary",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
