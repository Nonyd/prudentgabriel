"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({ email: z.string().email() });
type Form = z.infer<typeof schema>;

export function NewsletterSection() {
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
    <section className="bg-olive py-16 md:py-20">
      <div className="mx-auto max-w-lg px-8 text-center">
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.25em] text-white/50">Stay Connected</p>
        <h2 className="mt-3 font-display text-[40px] font-normal italic leading-[1.1] text-white">Join the Inner Circle.</h2>
        <p className="mt-4 font-body text-[14px] font-light text-white/65">
          New collections, exclusive access, and stories from the atelier.
        </p>
        {done ? (
          <p className="mt-8 font-body text-[14px] text-white/90">You&apos;re on the list. Thank you.</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex w-full max-w-md mx-auto border-b border-white/40 focus-within:border-white">
            <input
              type="email"
              placeholder="Your email address"
              className="h-12 min-w-0 flex-1 border-0 bg-transparent px-4 font-body text-[13px] font-light text-white placeholder:text-white/40 focus:outline-none"
              {...register("email")}
            />
            <button
              type="submit"
              disabled={formState.isSubmitting}
              className="h-12 shrink-0 bg-white px-7 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-olive transition-colors hover:bg-off-white disabled:opacity-60"
            >
              Subscribe
            </button>
          </form>
        )}
        <p className="mt-4 font-body text-[11px] text-white/35">No spam. Unsubscribe at any time.</p>
      </div>
    </section>
  );
}
