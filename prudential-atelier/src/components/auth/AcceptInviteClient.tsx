"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import type { Role } from "@prisma/client";

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

  async function submit() {
    setError(null);
    if (!firstName || !lastName || password.length < 8 || password !== confirmPassword) {
      setError("Please provide valid details and matching passwords.");
      return;
    }

    const response = await fetch("/api/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, firstName, lastName, password }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error || "Could not create account");
      return;
    }

    await signIn("credentials", {
      email,
      password,
      callbackUrl: "/admin",
      redirect: true,
    });
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="flex items-center justify-center bg-[#37392d] p-8">
        <div className="max-w-sm text-center">
          <p className="font-body text-[11px] uppercase tracking-[0.1em] text-[#D6D6D2]">Prudent Gabriel</p>
          <h1 className="mt-3 font-display text-4xl text-white">Join the Team</h1>
        </div>
      </div>
      <div className="flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-md">
          <h2 className="font-display text-[30px] text-ink">Create Your Admin Account</h2>
          <div className="mt-5 space-y-3">
            <input value={email} disabled className="w-full border border-[#EBEBEA] bg-[#FAFAFA] px-3 py-2 font-body text-sm text-[#6B6B68]" />
            <input value={role} disabled className="w-full border border-[#EBEBEA] bg-[#FAFAFA] px-3 py-2 font-body text-sm text-[#6B6B68]" />
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First Name" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 8 chars)" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm Password" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
            {error ? <p className="font-body text-xs text-red-600">{error}</p> : null}
            <button type="button" onClick={() => void submit()} className="w-full bg-[#37392d] px-3 py-2 font-body text-[12px] uppercase tracking-[0.08em] text-white">
              Create Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
