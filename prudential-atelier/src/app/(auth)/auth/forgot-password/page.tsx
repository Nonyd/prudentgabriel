"use client";

import Link from "next/link";
import Image from "next/image";
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
      <div className="relative hidden lg:block">
        <Image
          src="https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1200&q=80"
          alt="Prudential Atelier"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-choc/50" />
        <div className="absolute bottom-12 left-12 max-w-sm text-cream">
          <p className="font-serif text-3xl font-medium leading-tight">Reset your access</p>
          <p className="mt-4 font-sans text-xs font-light text-cream/80">
            We will email you a secure link to choose a new password.
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-center bg-ivory px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="font-serif text-xl tracking-[0.12em]">
            <span className="text-choc">Prudent</span>{" "}
            <span className="text-lightbr">Gabriel</span>
          </Link>
          <h2 className="mt-10 font-serif text-3xl font-medium text-choc">Forgot password</h2>
          <p className="mt-2 font-sans text-sm font-light text-text-mid">
            <Link href="/login" className="text-nut hover:underline">
              Back to sign in
            </Link>
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-mid">
                Email
              </span>
              <input type="email" autoComplete="email" className="input-field" {...register("email")} />
              {errors.email ? (
                <p className="mt-1 font-sans text-xs text-danger">{errors.email.message}</p>
              ) : null}
            </label>
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Send reset link
            </Button>
            <p className="font-sans text-xs font-light text-text-mid">
              If an account exists for this email, you will receive instructions shortly.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
