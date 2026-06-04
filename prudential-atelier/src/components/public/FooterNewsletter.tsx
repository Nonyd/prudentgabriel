"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";

const schema = z.object({ email: z.string().email() });
type Form = z.infer<typeof schema>;

export function FooterNewsletter() {
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: Form) => {
    const res = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) setDone(true);
  };

  return (
    <div>
      <p
        className="mb-4 uppercase"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.2em",
          color: "var(--lightbr)",
        }}
      >
        The Newsletter
      </p>
      <p className="mb-5 max-w-xs font-sans text-[13px] font-light leading-relaxed text-cream/75">
        Collections, ateliers and invitations — first.
      </p>
      {done ? (
        <p className="font-sans text-sm text-cream/90">You&apos;re on the list. Thank you.</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-sm border-b border-cream/25">
          <input
            type="email"
            placeholder="Your email"
            className="h-11 min-w-0 flex-1 border-0 bg-transparent font-sans text-[13px] font-light text-cream placeholder:text-cream/40 focus:outline-none"
            {...register("email")}
          />
          <button
            type="submit"
            disabled={formState.isSubmitting}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-cream transition-colors hover:text-sand disabled:opacity-60"
            aria-label="Subscribe"
          >
            <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </form>
      )}
    </div>
  );
}
