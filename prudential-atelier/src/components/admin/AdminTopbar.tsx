"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, Menu } from "lucide-react";

function pageTitleFromPath(pathname: string): string {
  if (pathname === "/admin") return "Dashboard";
  const seg = pathname.replace(/^\/admin\/?/, "").split("/").filter(Boolean);
  if (!seg.length) return "Dashboard";
  const last = seg[seg.length - 1];
  if (last === "new") return "New Product";
  if (last === "edit" && seg.length >= 2) return "Edit Product";
  return last
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

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

export function AdminTopbar({
  pendingBespokeCount,
  onOpenNav,
}: {
  pendingBespokeCount: number;
  onOpenNav?: () => void;
}) {
  const pathname = usePathname();
  const { data } = useSession();
  const title = pageTitleFromPath(pathname);
  const user = data?.user;
  const displayName = user?.name ?? user?.email ?? "Admin";

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#EBEBEA] bg-white px-4 md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="p-2 text-[#6B6B68] transition-colors hover:bg-[#F5F5F3] hover:text-black md:hidden"
          onClick={() => onOpenNav?.()}
          aria-label="Toggle navigation"
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>
        <p className="flex min-w-0 items-center font-body">
          <span className="text-[11px] text-[#A8A8A4]">Admin</span>
          <span className="mx-2 text-[11px] text-[#EBEBEA]">/</span>
          <span className="truncate text-xs font-medium text-black">{title}</span>
        </p>
      </div>
      <div className="flex items-center gap-3 md:gap-4">
        <Link
          href="/admin/bespoke"
          className="relative p-1.5 text-[#6B6B68] transition-colors hover:text-olive"
          aria-label="Notifications"
        >
          <Bell size={16} strokeWidth={1.5} />
          {pendingBespokeCount > 0 ? (
            <span
              className="absolute right-0.5 top-0.5 block h-1.5 w-1.5 rounded-full bg-[#37392d]"
              aria-hidden
            />
          ) : null}
        </Link>
        <span className="hidden h-4 w-px bg-[#EBEBEA] sm:block" aria-hidden />
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center bg-[#37392d] font-body text-[11px] font-medium text-white"
            title={user?.email ?? ""}
          >
            {initials(user?.name, user?.email)}
          </div>
          <span className="hidden max-w-[140px] truncate font-body text-xs text-black md:inline">{displayName}</span>
        </div>
      </div>
    </header>
  );
}
