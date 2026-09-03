"use client";

import { useEffect, useState } from "react";
import type { ImpersonationPayload } from "@/lib/admin-impersonate";

function remainingLabel(exp: number, now: number): string {
  const ms = Math.max(0, exp - now);
  if (ms <= 0) return "ending";
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  return `${mins} min left`;
}

export function AdminImpersonateBanner({ impersonation }: { impersonation?: ImpersonationPayload | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!impersonation) return;
    const tick = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(tick);
  }, [impersonation]);

  useEffect(() => {
    if (!impersonation) return;
    if (impersonation.exp > Date.now()) return;
    void fetch("/api/admin/impersonate", { method: "DELETE" }).finally(() => {
      window.location.href = "/admin/settings/users";
    });
  }, [impersonation, now]);

  if (!impersonation) return null;

  async function exitView() {
    await fetch("/api/admin/impersonate", { method: "DELETE" });
    window.location.href = "/admin/settings/users";
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-[#7A1F2B] px-4 py-3 text-white print:hidden md:px-8">
      <p className="font-sans text-sm font-medium">
        Viewing as {impersonation.targetName}. Read-only. {remainingLabel(impersonation.exp, now)}.
      </p>
      <button
        type="button"
        onClick={() => void exitView()}
        className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] underline underline-offset-2 hover:text-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Exit
      </button>
    </div>
  );
}
