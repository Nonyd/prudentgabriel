"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";

const CONFIRMATION = "SIGN OUT EVERYONE";

/**
 * Slice AZ9 — SUPER_ADMIN only (enforced by the API). For a suspected
 * compromise: every session on every device ends, including this one.
 */
export function SignOutEveryoneCard({ lastRevokedAt }: { lastRevokedAt: string | null }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/security/revoke-all-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: typed }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not sign everyone out");
      toast.success("Every account is signed out. Sign in again.");
      window.location.href = "/admin-login";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sign everyone out");
      setBusy(false);
    }
  };

  return (
    <section className="card-surface p-6">
      <h2 className="font-serif text-lg font-medium text-choc">Sign out everyone</h2>
      <p className="mt-2 max-w-prose font-sans text-sm text-text-mid">
        For a suspected break-in. Every session on every device ends within about 15 seconds — clients, staff,
        admins, and you. Passwords do not change; everyone signs in again. This is recorded in the activity log.
      </p>
      {lastRevokedAt ? (
        <p className="mt-2 font-sans text-xs text-text-light">
          Last used {new Date(lastRevokedAt).toLocaleString()}.
        </p>
      ) : null}
      <label className="mt-4 block font-sans text-xs text-text-mid">
        Type <span className="font-semibold text-choc">{CONFIRMATION}</span> to confirm
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="mt-1 block w-full max-w-sm rounded border border-sand px-3 py-2 font-sans text-sm"
          autoComplete="off"
        />
      </label>
      <Button
        type="button"
        className="mt-4"
        loading={busy}
        disabled={typed !== CONFIRMATION}
        onClick={() => void run()}
      >
        Sign out everyone
      </Button>
    </section>
  );
}
