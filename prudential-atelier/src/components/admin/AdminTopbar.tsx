"use client";

import { usePathname } from "next/navigation";
import { Download, ExternalLink, Menu, Search } from "lucide-react";
import Link from "next/link";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

function formatExecutiveDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export function AdminTopbar({ onOpenNav }: { onOpenNav?: () => void }) {
  const pathname = usePathname();
  const isExecutive = pathname === "/admin";
  const now = new Date();

  return (
    <header className="admin-topbar relative z-20 glass-1 flex h-auto min-h-14 shrink-0 items-center justify-between px-4 py-3 print:hidden md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="p-2 text-text-mid focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-choc md:hidden"
          onClick={() => onOpenNav?.()}
          aria-label="Toggle navigation"
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>
        {isExecutive ? (
          <div>
            <h1 className="admin-topbar-title font-serif font-medium text-choc">Executive Dashboard</h1>
            <p className="admin-topbar-subtitle font-sans text-text-mid">
              Your private overview · {formatExecutiveDate(now)}
            </p>
          </div>
        ) : (
          <h1 className="admin-topbar-title truncate font-serif font-medium capitalize text-choc">
            {pathname.replace(/^\/admin\/?/, "").split("/")[0]?.replace(/-/g, " ") || "Admin"}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <label className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
          <input
            type="search"
            placeholder="Search orders, clients..."
            className="input-field w-48 pl-9 md:w-56"
            aria-label="Search admin"
          />
        </label>
        <NotificationBell />
        <ThemeToggle className="p-2 transition-colors hover:text-choc" />
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          title="View live site"
          className="inline-flex items-center gap-1.5 font-sans text-[11px] font-medium text-text-mid transition-colors hover:text-choc"
        >
          <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <span className="hidden sm:inline">Homepage</span>
        </a>
        {isExecutive ? (
          <Link
            href="/admin/reports"
            className="hidden items-center gap-2 rounded-sm bg-gold/20 px-4 py-2 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-choc sm:inline-flex"
          >
            <Download className="h-3.5 w-3.5" />
            Weekly report
          </Link>
        ) : null}
      </div>
    </header>
  );
}
