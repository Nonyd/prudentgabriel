"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";

const schema = z.object({ email: z.string().email() });
type Form = z.infer<typeof schema>;

const labelStyle = {
  fontFamily: "var(--font-ui)",
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.18em",
  color: "var(--lightbr)",
} as const;

export function FooterNewsletter({
  headline = "New collections and atelier notes, first.",
  placeholder = "Your email",
}: {
  headline?: string;
  placeholder?: string;
}) {
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
    <div className="min-w-0">
      <p className="mb-4 uppercase" style={labelStyle}>
        The Newsletter
      </p>
      <p
        className="mb-5 max-w-xs whitespace-pre-line"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "14px",
          fontWeight: 400,
          color: "var(--sand)",
        }}
      >
        {headline}
      </p>
      {done ? (
        <p
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "13px",
            color: "var(--cream)",
          }}
        >
          You&apos;re on the list. Thank you.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-sm items-center gap-2">
          <input
            type="email"
            placeholder={placeholder}
            className="min-w-0 flex-1 border-0 border-b bg-transparent py-2.5 placeholder:text-text-light focus-visible:border-cream"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "12px",
              color: "var(--sand)",
              borderBottom: "0.5px solid rgba(226, 209, 194, 0.3)",
            }}
            {...register("email")}
          />
          <button
            type="submit"
            disabled={formState.isSubmitting}
            className="flex shrink-0 items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-60"
            style={{ color: "var(--lightbr)" }}
            aria-label="Subscribe"
          >
            <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </form>
      )}
    </div>
  );
}
