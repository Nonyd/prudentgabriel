"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * "View as client": on every page while an admin is in a client's account,
 * a bar says whose account this is, who is really here, that it is recorded,
 * and gives the way out. At the end of the hour it exits on its own.
 */
export function ViewAsBanner() {
  const { data } = useSession();
  const viewAs = data?.user?.viewAs;
  const [leaving, setLeaving] = useState(false);

  const exit = useCallback(async () => {
    setLeaving(true);
    try {
      const res = await fetch("/api/view-as", { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { redirect?: string };
      window.location.assign(body.redirect ?? "/admin");
    } catch {
      window.location.assign("/admin");
    }
  }, []);

  useEffect(() => {
    if (!viewAs) return;
    const ms = viewAs.exp - Date.now() - 5_000;
    const t = window.setTimeout(() => void exit(), Math.max(0, ms));
    return () => window.clearTimeout(t);
  }, [viewAs, exit]);

  if (!viewAs) return null;

  const until = new Date(viewAs.exp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <div aria-hidden className="h-16 sm:h-12" />
      <div
        role="status"
        className="fixed inset-x-0 bottom-0 z-[1000] border-t border-gold/50 bg-ink px-4 py-2.5 font-sans text-[13px] text-ivory shadow-[0_-4px_16px_rgba(0,0,0,0.18)]"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="min-w-0">
            <span className="font-medium">Viewing as {viewAs.clientName}</span>
            <span className="opacity-80">
              {" "}
              · you are {viewAs.actorName}. Everything you do here is recorded. Ends {until}.
            </span>
          </p>
          <button
            type="button"
            onClick={() => void exit()}
            disabled={leaving}
            className="shrink-0 border border-ivory/60 px-3 py-1 text-[11px] uppercase tracking-[0.12em] hover:bg-ivory hover:text-ink disabled:opacity-60"
          >
            {leaving ? "Leaving…" : "Exit to her file"}
          </button>
        </div>
      </div>
    </>
  );
}
