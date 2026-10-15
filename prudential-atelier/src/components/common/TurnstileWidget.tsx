"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("Turnstile failed to load"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export type TurnstileHandle = { reset: () => void };

/** Cloudflare Turnstile. Calls onToken with a token, or null when it expires or fails. */
export const TurnstileWidget = forwardRef<TurnstileHandle, { siteKey: string; onToken: (token: string | null) => void }>(
  function TurnstileWidget({ siteKey, onToken }, ref) {
    const box = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | null>(null);
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;

    useImperativeHandle(ref, () => ({
      reset() {
        if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
        onTokenRef.current(null);
      },
    }));

    useEffect(() => {
      let cancelled = false;
      loadScript()
        .then(() => {
          if (cancelled || !box.current || !window.turnstile || widgetId.current) return;
          const dark = document.documentElement.dataset.theme === "dark";
          widgetId.current = window.turnstile.render(box.current, {
            sitekey: siteKey,
            theme: dark ? "dark" : "light",
            appearance: "interaction-only",
            callback: (token: string) => onTokenRef.current(token),
            "expired-callback": () => onTokenRef.current(null),
            "error-callback": () => onTokenRef.current(null),
          });
        })
        .catch(() => onTokenRef.current(null));
      return () => {
        cancelled = true;
        if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      };
    }, [siteKey]);

    return <div ref={box} className="min-h-[1px]" />;
  },
);
