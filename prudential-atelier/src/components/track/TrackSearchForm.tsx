"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const NETWORK = "We could not reach the atelier. Check your connection and try again.";

export function TrackSearchForm({
  initialRef = "",
  notice,
  title = "Follow your commission",
  subtitle = "No login required — your order reference and the email on the order.",
}: {
  initialRef?: string;
  /** Shown above the form, e.g. when a tracking link has expired. */
  notice?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const [ref, setRef] = useState(initialRef);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ref.trim() || !email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      // POST, so the email never sits in a URL.
      const res = await fetch("/api/track/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: ref.trim(), email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        router.push(data.url);
        return;
      }
      setError(
        res.status === 429
          ? "Too many attempts. Please wait a few minutes and try again."
          : data.error ?? "We could not find an order with that reference and email.",
      );
    } catch {
      setError(NETWORK);
    } finally {
      setBusy(false);
    }
  }

  const field =
    "min-w-0 w-full border border-[0.5px] border-sand bg-input-bg px-5 py-3.5 font-body text-sm text-choc outline-none placeholder:text-text-light";

  return (
    <div className="px-4 py-16 md:py-20">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="font-serif text-[40px] font-normal leading-tight text-choc md:text-[52px]">{title}</h1>
        <p className="mt-3 font-body text-[14px] text-text-light">{subtitle}</p>
        {notice ? <p className="mt-4 font-body text-sm text-danger">{notice}</p> : null}

        <form onSubmit={handleSubmit} className="mx-auto mt-10 flex max-w-[480px] flex-col gap-3">
          <input
            type="text"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="ORD-7421"
            className={field}
            aria-label="Order reference"
            autoComplete="off"
            required
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="The email on your order"
            className={field}
            aria-label="Email on the order"
            autoComplete="email"
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="bg-choc px-8 py-3.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-cream transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Finding…" : "Track"}
          </button>
        </form>

        {error ? (
          <p role="alert" className="mt-4 font-body text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
