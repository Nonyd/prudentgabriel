"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { RecentActivityItem } from "@/lib/recent-activity";

/** First card waits until the page has settled; it must never compete with LCP or the cookie banner. */
const FIRST_DELAY_MS = 18_000;
const GAP_MIN_MS = 30_000;
const GAP_MAX_MS = 90_000;
const SHOW_MS = 6_000;

const HIDDEN_PREFIXES = ["/cart", "/checkout", "/payment"];
const DISMISS_KEY = "pg_activity_dismissed";
const SEEN_KEY = "pg_activity_seen";

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* private mode — the card just forgets */
  }
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** Purchases lead; view signals are spread between them. */
function buildQueue(items: RecentActivityItem[], seen: Set<string>): RecentActivityItem[] {
  const fresh = items.filter((i) => !seen.has(i.id));
  const purchases = fresh.filter((i) => i.kind === "purchase");
  const others = fresh.filter((i) => i.kind !== "purchase").sort(() => Math.random() - 0.5);
  const out: RecentActivityItem[] = [];
  while (purchases.length || others.length) {
    if (purchases.length) out.push(purchases.shift()!);
    if (purchases.length) out.push(purchases.shift()!);
    if (others.length) out.push(others.shift()!);
  }
  return out;
}

export function RecentActivityToast() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [current, setCurrent] = useState<RecentActivityItem | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const queue = useRef<RecentActivityItem[] | null>(null);
  const hovering = useRef(false);

  const hiddenHere = HIDDEN_PREFIXES.some((p) => pathname === p || pathname?.startsWith(`${p}/`));

  useEffect(() => {
    setDismissed(readSession(DISMISS_KEY) === "1");
  }, []);

  useEffect(() => {
    if (dismissed || hiddenHere) {
      setCurrent(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const next = async () => {
      if (cancelled) return;
      if (!queue.current) {
        try {
          const res = await fetch("/api/shop/recent-activity");
          const data = (await res.json()) as { items?: RecentActivityItem[] };
          const seen = new Set((readSession(SEEN_KEY) ?? "").split(",").filter(Boolean));
          queue.current = buildQueue(data.items ?? [], seen);
        } catch {
          queue.current = [];
        }
      }
      const item = queue.current.shift();
      if (!item || cancelled) return;
      const seen = (readSession(SEEN_KEY) ?? "").split(",").filter(Boolean);
      writeSession(SEEN_KEY, [...seen, item.id].slice(-50).join(","));
      setCurrent(item);
      const hide = () => {
        if (cancelled) return;
        if (hovering.current) {
          timer = setTimeout(hide, 1_000);
          return;
        }
        setCurrent(null);
        timer = setTimeout(next, GAP_MIN_MS + Math.random() * (GAP_MAX_MS - GAP_MIN_MS));
      };
      timer = setTimeout(hide, SHOW_MS);
    };

    timer = setTimeout(next, FIRST_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dismissed, hiddenHere]);

  const dismiss = () => {
    writeSession(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      className="pointer-events-none fixed left-3 z-[55] print:hidden sm:left-5"
      style={{ bottom: "calc(0.75rem + var(--cookie-banner-offset, 0px))" }}
      aria-live="polite"
    >
      <AnimatePresence>
        {current ? (
          <motion.div
            key={current.id}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onMouseEnter={() => (hovering.current = true)}
            onMouseLeave={() => (hovering.current = false)}
            className="pointer-events-auto border border-border bg-ivory/95 shadow-[0_12px_32px_-12px_rgba(40,24,12,0.35)] backdrop-blur-md relative flex w-[min(17rem,calc(100vw-6rem))] items-center gap-2.5 rounded-2xl p-2 pr-7 sm:w-[21rem] sm:gap-3 sm:p-2.5 sm:pr-8"
          >
            <Link
              href={`/shop/${current.product.slug}`}
              className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-sand sm:h-16 sm:w-12"
              tabIndex={-1}
              aria-hidden="true"
            >
              {current.product.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.product.image} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : null}
            </Link>
            <div className="min-w-0 flex-1">
              <p className="font-label text-[11px] leading-snug text-text-mid sm:text-[12px]">
                <Lead item={current} />
              </p>
              <Link
                href={`/shop/${current.product.slug}`}
                className="block truncate font-display text-[15px] leading-tight text-text-dark hover:text-choc hover:underline sm:text-[17px]"
              >
                {current.product.name}
              </Link>
              <p className="mt-0.5 font-label text-[10px] uppercase tracking-[0.12em] text-text-mid sm:text-[11px]">
                <Tail item={current} />
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Hide these notifications"
              className="absolute right-1.5 top-1.5 rounded-full p-1 text-text-mid hover:bg-sand/60 hover:text-text-dark"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Lead({ item }: { item: RecentActivityItem }) {
  if (item.kind === "purchase") {
    return (
      <>
        <span className="font-medium text-text-dark">{item.who}</span>
        {item.where ? ` in ${item.where}` : ""} purchased
      </>
    );
  }
  if (item.kind === "views") return <>Viewed {item.count} times today</>;
  return <>Popular this week</>;
}

function Tail({ item }: { item: RecentActivityItem }) {
  if (item.kind === "purchase") return <>{timeAgo(item.at)}</>;
  if (item.kind === "views") return <>Ready to wear</>;
  return <>Among the most-viewed pieces</>;
}
