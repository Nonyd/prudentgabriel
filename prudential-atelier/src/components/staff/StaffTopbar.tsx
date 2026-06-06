"use client";

import { usePathname } from "next/navigation";
import { ExternalLink, Menu } from "lucide-react";
import { StaffNotificationBell } from "@/components/staff/StaffNotificationBell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const PAGE_TITLES: Record<string, string> = {
  "/staff": "Dashboard",
  "/staff/tasks": "My Tasks",
  "/staff/time": "Time & Attendance",
  "/staff/profile": "Profile",
  "/staff/settings": "Account Settings",
  "/staff/notifications": "Notifications",
};

function titleForPath(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/staff/orders/")) return "Order Detail";
  const segment = pathname.replace(/^\/staff\/?/, "").split("/")[0]?.replace(/-/g, " ");
  return segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : "Staff Portal";
}

export function StaffTopbar({ onOpenNav }: { onOpenNav?: () => void }) {
  const pathname = usePathname();

  return (
    <header className="flex h-auto min-h-14 shrink-0 items-center justify-between border-b border-sand bg-ivory px-4 py-3 md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="p-2 text-text-mid md:hidden"
          onClick={() => onOpenNav?.()}
          aria-label="Toggle navigation"
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>
        <h1 className="truncate font-serif text-lg font-medium text-choc md:text-xl">
          {titleForPath(pathname)}
        </h1>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <ThemeToggle className="p-2 transition-colors hover:text-choc" />
        <StaffNotificationBell />
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
      </div>
    </header>
  );
}
