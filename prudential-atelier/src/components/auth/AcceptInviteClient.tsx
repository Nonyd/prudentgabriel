"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import type { Role } from "@prisma/client";
import { PasswordField } from "@/components/ui/PasswordField";
import { passwordPolicySchema } from "@/lib/password-policy";
import { NETWORK_ERROR_MESSAGE, authResponseMessage, hardNavigate, isSignInFailure } from "@/lib/client-auth";
import { signInErrorMessage } from "@/lib/signin-errors";

export function AcceptInviteClient({
  token,
  email,
  role,
}: {
  token: string;
  email: string;
  role: Role;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);

  async function submit() {
    if (busy) return;
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("Please give your first and last name.");
      return;
    }
    // The server's own rule, checked first so the most common mistake is named.
    const policy = passwordPolicySchema.safeParse(password);
    if (!policy.success) {
      setError(policy.error.issues[0]?.message ?? "Password does not meet the rules.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    let accountCreated = false;
    try {
      const response = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, firstName, lastName, password }),
      });
      if (!response.ok) {
        setError(await authResponseMessage(response, "Could not create your account."));
        return;
      }
      accountCreated = true;
      setCreated(true);
      const result = await signIn("credentials", { email, password, redirect: false });
      if (isSignInFailure(result)) {
        // The account exists; only the automatic sign-in failed. Say so.
        setError(`Your account is ready, but we could not sign you in automatically. ${signInErrorMessage(result)}`);
        return;
      }
      hardNavigate("/admin");
    } catch {
      setError(accountCreated ? "Your account is ready. Please sign in." : NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="flex items-center justify-center bg-[#37392d] p-8">
        <div className="max-w-sm text-center">
          <p className="font-body text-[11px] uppercase tracking-[0.1em] text-[#D6D6D2]">Prudent Gabriel</p>
          <h1 className="mt-3 font-display text-4xl text-white">Join the Team</h1>
        </div>
      </div>
      <div className="flex items-center justify-center bg-input-bg p-8">
        <div className="w-full max-w-md">
          <h2 className="font-display text-[30px] text-ink">Create Your Admin Account</h2>
          <div className="mt-5 space-y-3">
            <input value={email} disabled className="w-full border border-[#EBEBEA] bg-[#FAFAFA] px-3 py-2 font-body text-sm text-[#6B6B68]" />
            <input value={role} disabled className="w-full border border-[#EBEBEA] bg-[#FAFAFA] px-3 py-2 font-body text-sm text-[#6B6B68]" />
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First Name" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
            <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password: 8+ characters, a capital letter and a number" autoComplete="new-password" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
            <PasswordField value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm Password" autoComplete="new-password" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
            {error ? (
              <p className="font-body text-xs text-red-600" role="alert">
                {error}
                {created ? (
                  <>
                    {" "}
                    <a href="/login?tab=admin" className="underline">
                      Sign in
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="w-full bg-[#37392d] px-3 py-2 font-body text-[12px] uppercase tracking-[0.08em] text-white disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
