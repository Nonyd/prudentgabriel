"use client";

import { useState } from "react";
import type { PFAStudentInfo } from "@/lib/pfa-verify";

type Props = {
  regNumber: string;
  onRegNumberChange: (v: string) => void;
  verified: PFAStudentInfo | null;
  onVerified: (info: PFAStudentInfo | null) => void;
  disabled?: boolean;
};

export function PFAVerificationBlock({
  regNumber,
  onRegNumberChange,
  verified,
  onVerified,
  disabled,
}: Props) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/careers/verify-pfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regNumber }),
      });
      const data = (await res.json()) as PFAStudentInfo;
      if (!data.valid) {
        setError(data.error || "Registration number not found.");
        onVerified(null);
        return;
      }
      onVerified(data);
    } catch {
      setError("Verification failed. Please try again.");
      onVerified(null);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="rounded-[3px] border border-amber-200 bg-amber-50/50 p-5">
      <p className="font-label text-[10px] uppercase tracking-[0.16em] text-amber-900">PFA Student Verification</p>
      <p className="mt-2 font-body text-sm text-choc">
        This position is open to PFA students applying for Industrial Training (IT).
      </p>
      <label className="mt-4 block font-body text-xs text-text-light">Your PFA Registration Number</label>
      <div className="mt-2 flex gap-2">
        <input
          value={regNumber}
          onChange={(e) => {
            onRegNumberChange(e.target.value.toUpperCase());
            onVerified(null);
            setError(null);
          }}
          placeholder="PFA/2024/0142"
          disabled={disabled || checking}
          className="flex-1 rounded-[3px] border border-sand bg-input-bg px-3 py-2 font-body text-sm uppercase outline-none focus:border-lightbr"
        />
        <button
          type="button"
          disabled={disabled || checking || regNumber.trim().length < 4}
          onClick={() => void verify()}
          className="rounded-[3px] bg-choc px-4 py-2 font-label text-[10px] font-semibold uppercase tracking-wide text-cream disabled:opacity-50"
        >
          {checking ? "…" : "Verify"}
        </button>
      </div>
      {verified?.valid ? (
        <p className="mt-3 font-body text-sm text-green-800">
          ✓ Verified: {verified.name}
          <br />
          <span className="text-text-light">
            {verified.course} · Year {verified.year}
          </span>
        </p>
      ) : null}
      {error ? <p className="mt-3 font-body text-sm text-red-700">✗ {error}</p> : null}
    </div>
  );
}
