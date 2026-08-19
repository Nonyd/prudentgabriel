"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { Logo } from "@/components/ui/Logo";
import { hasAnyAdminPermission } from "@/lib/roles";

export function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const required = searchParams.get("required") === "true";
  const { data: session, update } = useSession();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const data = (await res.json()) as { error?: Record<string, string[]> | string };
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.confirmPassword?.[0] ?? data.error?.password?.[0] ?? "Could not update password";
        throw new Error(msg);
      }
      await update();
      toast.success("Password updated");
      const role = session?.user?.role ?? "";
      const isStaffUser = session?.user?.isStaff === true || role === "STAFF";
      const destination = isStaffUser ? "/staff" : hasAnyAdminPermission(role) ? "/admin" : "/account";
      router.push(destination);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="relative w-full max-w-[420px] overflow-y-auto"
      style={{
        background: "var(--ivory)",
        borderRadius: "12px",
        padding: "48px 40px",
        boxShadow: "0 24px 48px rgba(42, 26, 14, 0.08)",
      }}
    >
      <div className="mb-8 flex justify-center">
        <Logo />
      </div>
      <h1 className="font-display text-[28px] text-[var(--chocolate)]">Choose your password</h1>
      <p className="mt-2 font-body text-[13px] text-[var(--text-mid)]">
        {required
          ? "Set a password you'll remember before continuing."
          : "Update your account password."}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="font-body text-[11px] uppercase tracking-wide text-[var(--text-light)]">
            New password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border border-[var(--border)] bg-input-bg px-3 py-2.5 font-body text-sm outline-none focus:border-[var(--wine)]"
            required
            minLength={8}
          />
        </div>
        <div>
          <label className="font-body text-[11px] uppercase tracking-wide text-[var(--text-light)]">
            Confirm password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full border border-[var(--border)] bg-input-bg px-3 py-2.5 font-body text-sm outline-none focus:border-[var(--wine)]"
            required
            minLength={8}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mt-2 w-full bg-[var(--wine)] py-3 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Set password →"}
        </button>
      </form>
    </div>
  );
}
