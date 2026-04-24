"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { FacebookIcon, InstagramIcon } from "@/components/icons/SocialIcons";

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setSent(true);
      toast.success("Message sent");
    } catch {
      toast.error("Could not send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-site gap-12 px-4 py-20 lg:grid-cols-[3fr_2fr]">
      <div>
        <h1 className="font-display text-4xl text-wine">Get in Touch</h1>
        <p className="mt-2 text-charcoal-mid">We&apos;d love to hear from you.</p>
        {sent ? (
          <p className="mt-8 text-success">Message sent! We&apos;ll respond within 24 hours. ✓</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <input name="name" required placeholder="Name" className="w-full border-b border-border bg-transparent py-2" />
            <input name="email" type="email" required placeholder="Email" className="w-full border-b border-border bg-transparent py-2" />
            <select name="subject" required className="w-full border-b border-border bg-transparent py-2">
              <option>General</option>
              <option>Order Enquiry</option>
              <option>Press</option>
              <option>Bespoke</option>
              <option>Other</option>
            </select>
            <textarea name="message" required rows={5} placeholder="Message" className="w-full rounded-sm border border-border p-3" />
            <button type="submit" disabled={busy} className="rounded-sm bg-wine px-6 py-2 text-ivory disabled:opacity-50">
              Send message
            </button>
          </form>
        )}
      </div>
      <div className="rounded-sm bg-wine p-10 text-ivory">
        <p className="font-medium">Prudential Atelier, Lagos, Nigeria</p>
        <p className="mt-4">
          <a href="mailto:hello@prudentgabriel.com" className="underline">
            hello@prudentgabriel.com
          </a>
        </p>
        <p className="mt-4">
          <a href="https://instagram.com/prudent_gabriel" target="_blank" rel="noreferrer" className="underline">
            @prudent_gabriel
          </a>
        </p>
        <p className="mt-6 text-sm text-ivory/80">Monday – Saturday: 9am – 6pm (WAT)</p>
        <p className="text-sm text-ivory/80">Sunday: Closed</p>
        <div className="mt-6 flex gap-4 text-ivory">
          <InstagramIcon size={24} />
          <FacebookIcon size={24} />
        </div>
      </div>
    </div>
  );
}
