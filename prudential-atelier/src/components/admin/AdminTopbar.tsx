"use client";

import { usePathname } from "next/navigation";
import { Bell, Mail, Menu, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import { getInitials } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

function pageTitleFromPath(pathname: string): string {
  if (pathname === "/admin") return "Dashboard";
  const seg = pathname.replace(/^\/admin\/?/, "").split("/").filter(Boolean);
  if (!seg.length) return "Dashboard";
  return seg[seg.length - 1]
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function AdminTopbar({ onOpenNav }: { onOpenNav?: () => void }) {
  const pathname = usePathname();
  const { data } = useSession();
  const title = pageTitleFromPath(pathname);
  const user = data?.user;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-sand bg-ivory px-4 md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="p-2 text-text-mid md:hidden"
          onClick={() => onOpenNav?.()}
          aria-label="Toggle navigation"
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>
        <h1 className="truncate font-serif text-lg font-medium text-choc">{title}</h1>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <label className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
          <input
            type="search"
            placeholder="Search..."
            className="input-field w-48 pl-9 md:w-56"
            aria-label="Search admin"
          />
        </label>
        <button type="button" className="relative text-text-mid" aria-label="Notifications">
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.5} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-danger" />
        </button>
        <button type="button" className="hidden text-text-mid sm:inline-flex" aria-label="Mail">
          <Mail className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>
        <ThemeToggle />
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-choc font-sans text-[10px] font-medium text-cream"
          title={user?.email ?? ""}
        >
          {getInitials(user?.name ?? user?.email ?? "A")}
        </div>
      </div>
    </header>
  );
}
