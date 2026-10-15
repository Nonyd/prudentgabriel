"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type State = "working" | "verified" | "already" | "expired" | "invalid" | "error";

const COPY: Record<State, { title: string; body: string }> = {
  working: { title: "Confirming…", body: "One moment while we confirm your email." },
  verified: {
    title: "Email confirmed",
    body: "Thank you. Your account now shows everything the atelier holds under your email.",
  },
  already: { title: "Already confirmed", body: "This email was already confirmed. Nothing more to do." },
  expired: {
    title: "This link has expired",
    body: "Links last 24 hours. Sign in and use “Send a new link” on your account page.",
  },
  invalid: {
    title: "This link does not work",
    body: "It may have been used already, or a newer link was sent. Sign in and send a new one from your account page.",
  },
  error: { title: "Something went wrong", body: "We could not reach the server. Please try the link again." },
};

/**
 * The link confirms from the page, not on the GET: mail scanners that open
 * every link in an inbox would otherwise spend it before she clicks.
 */
export default function VerifyEmailPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";
  const [state, setState] = useState<State>("working");
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json() as Promise<{ result?: State }>)
      .then((j) => setState(j.result && j.result in COPY ? j.result : "invalid"))
      .catch(() => setState("error"));
  }, [token]);

  const copy = COPY[state];
  const done = state === "verified" || state === "already";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-center bg-choc p-12 text-cream lg:flex">
        <p className="font-label text-[11px] tracking-[0.2em] text-gold">Prudential Atelier</p>
        <h1 className="mt-6 font-display text-4xl font-medium italic">Your email</h1>
      </div>
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-md" role="status" aria-live="polite">
          <h2 className="font-display text-3xl text-charcoal">{copy.title}</h2>
          <p className="mt-3 font-body text-sm leading-6 text-charcoal-light">{copy.body}</p>
          {state !== "working" ? (
            <Link
              href={done ? "/account" : "/auth/login?callbackUrl=/account"}
              className="mt-8 inline-flex items-center justify-center bg-choc px-7 py-3 font-label text-[11px] uppercase tracking-[0.16em] text-cream"
            >
              {done ? "Go to my account" : "Sign in"}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
