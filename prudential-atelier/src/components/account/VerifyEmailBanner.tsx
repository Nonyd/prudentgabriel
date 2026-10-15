"use client";

import { useState } from "react";

/** Shown in the account area until she confirms her email. */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    setState("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/verify-email/resend", { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "We could not send the email just now.");
      setState("sent");
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : "We could not send the email just now.");
    }
  }

  return (
    <div role="status" className="mb-6 border border-gold/40 bg-gold/10 px-5 py-4">
      <p className="font-body text-sm leading-6 text-charcoal">
        <strong className="font-medium">Please confirm your email.</strong> We sent a link to{" "}
        <span className="break-all">{email}</span>. Until you confirm it, consultations, commissions and chats the
        atelier filed under this email before you signed up stay hidden here.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void resend()}
          disabled={state === "sending" || state === "sent"}
          className="font-label text-[11px] uppercase tracking-[0.14em] text-choc underline underline-offset-4 disabled:opacity-60"
        >
          {state === "sending" ? "Sending…" : state === "sent" ? "Link sent" : "Send a new link"}
        </button>
        {state === "sent" ? (
          <span className="font-body text-xs text-charcoal-mid">Check your inbox, and the spam folder.</span>
        ) : null}
        {message ? <span className="font-body text-xs text-error">{message}</span> : null}
      </div>
    </div>
  );
}
