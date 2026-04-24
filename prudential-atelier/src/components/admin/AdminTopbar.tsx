"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, Menu } from "lucide-react";
import Link from "next/link";

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

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gold/10 bg-[#1A1A1A] px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-sm p-2 text-[#8A8A8A] hover:bg-[#252525] hover:text-gold md:hidden"
          onClick={() => onOpenNav?.()}
          aria-label="Toggle navigation"
        >
          <Menu size={22} />
        </button>
        <p className="font-body text-sm text-[#8A8A8A]">
        <span className="text-ivory/60">Admin</span>
        <span className="mx-2 text-gold/30">/</span>
        <span className="text-ivory">{title}</span>
      </p>
      </div>
      <div className="flex items-center gap-4">
        <Link
          href="/admin/bespoke"
          className="relative rounded-sm p-2 text-[#8A8A8A] transition-colors hover:bg-[#252525] hover:text-gold"
          aria-label="Bespoke notifications"
        >
          <Bell size={20} />
          {pendingBespokeCount > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-wine px-1 text-[10px] font-medium text-gold">
              {pendingBespokeCount > 9 ? "9+" : pendingBespokeCount}
            </span>
          ) : null}
        </Link>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-wine text-xs font-medium text-gold"
          title={user?.email ?? ""}
        >
          {initials(user?.name, user?.email)}
        </div>
      </div>
    </header>
  );
}
