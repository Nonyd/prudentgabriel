"use client";

import { useState } from "react";

export function UnsubscribeClient({
  token,
  status,
  email,
}: {
  token: string;
  status: "confirm" | "done" | "invalid";
  email: string | null;
}) {
  const [state, setState] = useState(status);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      const res = await fetch(`/api/unsubscribe/${encodeURIComponent(token)}`, { method: "POST" });
      if (res.ok) setState("done");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-20">
      <p className="font-body text-[10px] uppercase tracking-[0.2em] text-[#6B6B68]">Prudential Atelier</p>
      {state === "invalid" ? (
        <>
          <h1 className="mt-4 font-display text-3xl text-ink">Link not found</h1>
          <p className="mt-4 font-body text-[15px] text-[#6B6B68]">
            This unsubscribe link is invalid or has expired. You can write to hello@prudentgabriel.com
            and we will remove you from the list.
          </p>
        </>
      ) : state === "done" ? (
        <>
          <h1 className="mt-4 font-display text-3xl text-ink">You are unsubscribed</h1>
          <p className="mt-4 font-body text-[15px] text-[#6B6B68]">
            {email ? `${email} will` : "You will"} no longer receive collection announcements or other
            marketing email. Order confirmations and account messages will still be sent when needed.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-4 font-display text-3xl text-ink">Unsubscribe</h1>
          <p className="mt-4 font-body text-[15px] text-[#6B6B68]">
            Stop marketing email{email ? ` to ${email}` : ""}. Transactional mail (orders, bookings)
            is not affected.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            className="mt-8 bg-[#442913] px-6 py-3 font-body text-[13px] uppercase tracking-wide text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Unsubscribe from marketing"}
          </button>
        </>
      )}
    </main>
  );
}
