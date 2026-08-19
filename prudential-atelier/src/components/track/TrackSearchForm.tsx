"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TrackSearchForm({
  notFound,
  eyebrow = "ORDER TRACKING",
  title = "Follow your commission",
  subtitle = "No login required — just your order reference.",
}: {
  notFound?: boolean;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const [ref, setRef] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = ref.trim();
    if (!trimmed) return;
    router.push(`/track?ref=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="bg-ivory px-4 py-16 md:py-20">
      <div className="mx-auto max-w-lg text-center">
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-lightbr">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-[40px] font-normal leading-tight text-choc md:text-[52px]">{title}</h1>
        <p className="mt-3 font-body text-[14px] text-text-light">{subtitle}</p>

        <form onSubmit={handleSubmit} className="mx-auto mt-10 flex max-w-[480px] overflow-hidden rounded border border-[0.5px] border-sand">
          <input
            type="text"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="ORD-7421"
            className="min-w-0 flex-1 border-0 bg-input-bg px-5 py-3.5 font-body text-sm text-choc outline-none placeholder:text-text-light"
            aria-label="Order reference"
          />
          <button
            type="submit"
            className="shrink-0 bg-choc px-8 py-3.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-cream transition-opacity hover:opacity-90"
          >
            Track
          </button>
        </form>

        {notFound ? (
          <p className="mt-4 font-body text-sm text-danger">Order not found. Please check your reference and try again.</p>
        ) : null}
      </div>
    </div>
  );
}
