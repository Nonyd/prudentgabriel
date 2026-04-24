"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/validations/auth";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (data: ForgotPasswordInput) => {
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-center bg-wine p-12 text-ivory lg:flex">
        <p className="font-label text-[11px] tracking-[0.2em] text-gold">Prudential Atelier</p>
        <h1 className="mt-6 font-display text-4xl font-medium italic">Reset access</h1>
        <p className="mt-4 max-w-sm font-body text-sm text-ivory/80">
          We will email you a reset link when that flow is connected (Stage 9).
        </p>
      </div>
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <h2 className="font-display text-3xl text-charcoal">Forgot password</h2>
          <p className="mt-2 font-body text-sm text-charcoal-light">
            <Link href="/auth/login" className="text-wine hover:underline">
              Back to sign in
            </Link>
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="font-label text-[10px] uppercase tracking-[0.15em] text-charcoal-mid">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="mt-2 w-full border border-border bg-cream px-4 py-3 font-body text-sm outline-none focus:border-wine"
                {...register("email")}
              />
              {errors.email && (
                <p className="mt-1 font-body text-xs text-error">{errors.email.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Send reset link
            </Button>
            <p className="font-body text-xs text-charcoal-light">
              If an account exists for this email, you will receive instructions shortly.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
