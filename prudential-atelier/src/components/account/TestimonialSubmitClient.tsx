"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { StarRating } from "@/components/ui/StarRating";

export function TestimonialSubmitClient({ firstName }: { firstName: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [clientImage, setClientImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/account/upload", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      setClientImage(data.url);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      toast.error("Please select a rating");
      return;
    }
    if (body.trim().length < 30) {
      toast.error("Please write at least 30 characters");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/account/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, body: body.trim(), clientImage }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not submit");
        return;
      }
      setDone(true);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl rounded-md border border-sand bg-white px-8 py-12 text-center">
        <p className="font-display text-2xl text-choc">✓ Thank you, {firstName}!</p>
        <p className="mt-4 font-body text-sm text-text-mid">
          Your testimonial has been submitted and will appear after approval.
        </p>
        <Link href="/account" className="btn-primary mt-8 inline-flex px-6 py-3 text-[10px]">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mx-auto max-w-xl space-y-8">
      <div>
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr">Your story</p>
        <h1 className="mt-2 font-display text-[32px] text-choc">Share your experience</h1>
      </div>

      <div>
        <p className="font-sans text-sm text-text-mid">Your rating:</p>
        <StarRating rating={rating} size="lg" variant="gold" interactive onChange={setRating} className="mt-2" />
      </div>

      <div>
        <label htmlFor="testimonial-body" className="font-sans text-sm text-text-mid">
          Your testimonial:
        </label>
        <textarea
          id="testimonial-body"
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 600))}
          rows={5}
          className="mt-2 w-full rounded-sm border border-sand bg-white px-4 py-3 font-body text-sm text-choc outline-none focus:border-nut"
          placeholder="Tell us about your Prudential experience…"
        />
        <p className="mt-1 font-body text-xs text-text-light">{body.length} / 600</p>
      </div>

      <div>
        <p className="font-sans text-sm text-text-mid">Add a photo (optional):</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mt-2 block w-full font-body text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleUpload(f);
          }}
        />
        <p className="mt-1 font-body text-xs text-text-light">
          Accepted: JPG, PNG · Max 5MB. Your photo helps other women connect with your story.
        </p>
        {uploading ? <p className="mt-2 font-body text-xs text-text-mid">Uploading…</p> : null}
        {clientImage ? (
          <div className="relative mt-3 h-[120px] w-[120px] overflow-hidden rounded-md">
            <Image src={clientImage} alt="Your photo" fill className="object-cover" sizes="120px" />
          </div>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={submitting || uploading}
        className="btn-primary px-8 py-3 text-[10px] tracking-[0.16em] disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit testimonial →"}
      </button>
    </form>
  );
}
