"use client";

import { ExternalLink, LayoutGrid, LogOut, Search, UserRoundCog, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Session } from "next-auth";
import { cn, getInitials } from "@/lib/utils";
import { roleLabel } from "@/lib/roles";
import {
  adminNavItemIsActive,
  adminNavItemMatchesQuery,
  visibleAdminNavSections,
  type AdminNavItemDef,
  type AdminNavSectionDef,
} from "@/lib/admin-route-access";
import { RAISED_TAB, iconFor, splitTabs, tabLabel } from "./admin-nav-icons";

/**
 * Phone navigation, app style: a bottom tab bar with the most-used sections (the atelier pipeline
 * as the raised middle button) and a More sheet with every other section as an icon grid, grouped
 * as in the sidebar. Hidden from lg up, where the sidebar takes over.
 */
export function AdminMobileNav({
  session,
  badges = {},
  accessRole,
  accessEmail,
  viewer = null,
  permissionGrants = [],
  permissionRevokes = [],
  rolePermissions,
  previewRole = null,
}: {
  session: Session;
  badges?: Record<string, number>;
  accessRole?: string;
  accessEmail?: string | null;
  viewer?: { name: string; role: string } | null;
  permissionGrants?: readonly string[];
  permissionRevokes?: readonly string[];
  rolePermissions?: readonly string[] | "*";
  previewRole?: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const { data: liveSession } = useSession();
  const user = liveSession?.user ?? session.user;
  const displayName = viewer?.name ?? user?.name ?? user?.email ?? "Admin";
  const avatarUrl = viewer ? null : user?.image;
  const realRole = viewer?.role ?? user?.role ?? session.user?.role ?? "ADMIN";
  const role = accessRole ?? realRole;
  const email =
    accessEmail !== undefined ? accessEmail : previewRole ? null : (user?.email ?? session.user?.email ?? null);

  const [hash, setHash] = useState("");
  useEffect(() => {
    const apply = () => setHash(window.location.hash);
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [pathname]);

  const grantsKey = permissionGrants.join(",");
  const revokesKey = permissionRevokes.join(",");
  const rolePermsKey = Array.isArray(rolePermissions) ? rolePermissions.join(",") : rolePermissions ?? "";
  const { tabs, more } = useMemo(
    () =>
      splitTabs(
        visibleAdminNavSections(role, email, {
          email,
          grants: permissionGrants,
          revokes: permissionRevokes,
          rolePermissions,
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- grantsKey/revokesKey/rolePermsKey are the value inputs
    [role, email, grantsKey, revokesKey, rolePermsKey],
  );

  const isActive = (item: AdminNavItemDef) => adminNavItemIsActive(pathname, search, hash, item);
  const moreActive =
    more.some((s) => s.items.some(isActive)) || pathname.startsWith("/admin/account-settings");
  const moreBadge = more.reduce(
    (n, s) => n + s.items.reduce((m, i) => m + (i.badgeKey ? (badges[i.badgeKey] ?? 0) : 0), 0),
    0,
  );

  const [open, setOpen] = useState(false);
  // Close the sheet whenever the page changes.
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }

  return (
    <>
      <nav
        aria-label="Admin sections"
        className="admin-tabbar glass-1 fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 print:hidden lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-[560px] items-end justify-around px-1">
          {tabs.map((t) => {
            const Icon = iconFor(t);
            const active = isActive(t);
            const badge = t.badgeKey ? (badges[t.badgeKey] ?? 0) : 0;
            const label = tabLabel(t);
            if (t.href === RAISED_TAB) {
              return (
                <li key={t.href} className="flex flex-1 justify-center">
                  <Link
                    href={t.href}
                    aria-current={active ? "page" : undefined}
                    className="tab-link -mt-5 flex flex-col items-center gap-1 pb-2"
                  >
                    <span
                      className={cn(
                        "relative flex h-14 w-14 items-center justify-center rounded-full bg-wine text-[#f7f2ec] shadow-[0_8px_24px_rgba(68,41,19,0.35)] ring-4 ring-[var(--bg-page)] transition-transform active:scale-95",
                        active && "bg-wine-hover",
                      )}
                    >
                      <Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden />
                      {badge ? <TabBadge count={badge} /> : null}
                    </span>
                    <span className={cn("font-sans text-11px font-medium", active ? "text-choc" : "text-text-mid")}>
                      {label}
                    </span>
                  </Link>
                </li>
              );
            }
            return (
              <li key={t.href} className="flex-1">
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className="tab-link flex flex-col items-center gap-1 pb-2 pt-2.5"
                >
                  <TabIcon Icon={Icon} active={active} badge={badge} />
                  <span className={cn("font-sans text-11px font-medium", active ? "text-choc" : "text-text-mid")}>
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
              className="tab-link flex w-full flex-col items-center gap-1 pb-2 pt-2.5"
            >
              <TabIcon Icon={LayoutGrid} active={moreActive || open} badge={moreBadge} />
              <span
                className={cn("font-sans text-11px font-medium", moreActive || open ? "text-choc" : "text-text-mid")}
              >
                More
              </span>
            </button>
          </li>
        </ul>
      </nav>

      {open ? (
        <MoreSheet
          sections={more}
          badges={badges}
          isActive={isActive}
          pathname={pathname}
          displayName={displayName}
          avatarUrl={avatarUrl}
          roleText={previewRole ? `As ${roleLabel(role)}` : roleLabel(realRole)}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function TabBadge({ count }: { count: number }) {
  return (
    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-wine px-1 font-sans text-10px font-semibold leading-none text-[#f7f2ec] ring-2 ring-[var(--bg-page)]">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function TabIcon({ Icon, active, badge = 0 }: { Icon: LucideIcon; active: boolean; badge?: number }) {
  return (
    <span
      className={cn(
        "relative flex h-8 w-14 items-center justify-center rounded-full transition-colors",
        active ? "bg-sand/50 text-choc" : "text-text-mid",
      )}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2 : 1.5} aria-hidden />
      {badge ? <TabBadge count={badge} /> : null}
    </span>
  );
}

function MoreSheet({
  sections,
  badges,
  isActive,
  pathname,
  displayName,
  avatarUrl,
  roleText,
  onClose,
}: {
  sections: AdminNavSectionDef[];
  badges: Record<string, number>;
  isActive: (item: AdminNavItemDef) => boolean;
  pathname: string;
  displayName: string;
  avatarUrl?: string | null;
  roleText: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    sheet.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Stop the page behind from scrolling while the sheet is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);

  const q = query.trim();
  const shown = q
    ? sections
        .map((s) => ({ ...s, items: s.items.filter((i) => adminNavItemMatchesQuery(q, s.label, i)) }))
        .filter((s) => s.items.length > 0)
    : sections;

  return (
    <div className="fixed inset-0 z-[60] print:hidden lg:hidden">
      {/* Tap outside to close; the close button and Escape cover keyboard users. */}
      <div
        aria-hidden
        onClick={onClose}
        className="admin-sheet-backdrop absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="admin-sheet absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-[24px] border-t border-[var(--glass-edge)] bg-[var(--glass-1-solid)] px-4 pt-3 focus:outline-none"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
        data-lenis-prevent
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-text-light/40" aria-hidden />
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="font-serif text-24px font-medium text-choc">
            All sections
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--glass-edge)] text-text-mid"
          >
            <X className="h-5 w-5" strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        <label className="relative mb-5 block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light"
            strokeWidth={1.5}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a section"
            aria-label="Find a section"
            autoComplete="off"
            className="input-field w-full rounded-full py-2.5 pl-9 pr-3 font-sans"
          />
        </label>

        {shown.length === 0 ? <p className="mb-4 font-sans text-13px text-text-mid">Nothing matches.</p> : null}

        {shown.map((section) => (
          <section key={section.id} className="mb-5">
            <h3 className="mb-2 px-1 font-sans text-10px font-semibold uppercase tracking-[0.2em] text-text-light">
              {section.label}
            </h3>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {section.items.map((item) => {
                const Icon = iconFor(item);
                const active = isActive(item);
                const badge = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-full flex-col items-center gap-2 rounded-[16px] border px-1.5 py-3.5 text-center transition-colors active:scale-[0.97]",
                        active ? "border-choc/40 bg-sand/40" : "border-[var(--glass-edge)] bg-[var(--glass-1-fill)]",
                      )}
                    >
                      <span
                        className={cn(
                          "relative flex h-11 w-11 items-center justify-center rounded-[12px]",
                          active ? "bg-wine text-[#f7f2ec]" : "bg-sand/45 text-choc",
                        )}
                      >
                        <Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden />
                        {badge ? <TabBadge count={badge} /> : null}
                      </span>
                      <span className="font-sans text-12px font-medium leading-tight text-choc">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <div className="mt-2 rounded-[18px] border border-[var(--glass-edge)] bg-[var(--glass-1-fill)] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sand/50 font-sans text-13px font-medium text-choc">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                getInitials(displayName)
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate font-sans text-15px font-medium text-choc">{displayName}</p>
              <p className="mt-0.5 font-sans text-10px font-semibold uppercase tracking-[0.14em] text-text-light">
                {roleText}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
            <Link
              href="/admin/account-settings"
              onClick={onClose}
              aria-current={pathname.startsWith("/admin/account-settings") ? "page" : undefined}
              className="flex items-center justify-center gap-2 rounded-full border border-[var(--glass-edge)] px-3 py-3 font-sans text-13px text-choc"
            >
              <UserRoundCog className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Account
            </Link>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-full border border-[var(--glass-edge)] px-3 py-3 font-sans text-13px text-choc"
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Website
            </a>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/login?tab=admin" })}
              className="flex items-center justify-center gap-2 rounded-full border border-[var(--glass-edge)] px-3 py-3 font-sans text-13px text-choc"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
