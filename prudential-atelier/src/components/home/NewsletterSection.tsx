"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Button } from "@/components/ui/Button";

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
    <section className="relative overflow-hidden bg-wine py-20">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      <div className="relative z-10 mx-auto max-w-lg px-5 text-center">
        <SectionLabel light className="text-ivory/70">
          INNER CIRCLE
        </SectionLabel>
        <h2 className="mt-4 font-display text-3xl italic text-gold md:text-4xl">Join the Atelier Community</h2>
        <p className="mt-4 font-body text-ivory/70">
          Early access to collections, exclusive offers, and stories from the atelier.
        </p>
        {done ? (
          <p className="mt-8 font-body text-ivory">✓ You&apos;re on the list. Welcome to the inner circle.</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              placeholder="Email address"
              className="flex-1 rounded-sm border border-ivory/40 bg-transparent px-4 py-3 text-ivory placeholder:text-ivory/40 focus:border-gold focus:outline-none"
              {...register("email")}
            />
            <Button type="submit" variant="gold" loading={formState.isSubmitting}>
              Subscribe
            </Button>
          </form>
        )}
        <p className="mt-4 text-xs text-ivory/40">No spam, ever. Unsubscribe anytime.</p>
      </div>
    </section>
  );
}
