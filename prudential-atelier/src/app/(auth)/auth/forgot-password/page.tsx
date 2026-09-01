"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/validations/auth";
import { Button } from "@/components/ui/Button";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";

function signInHref(from: string | null): string {
  if (from === "staff") return "/login?tab=staff";
  if (from === "admin") return "/login?tab=admin";
  return "/auth/login";
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const backHref = signInHref(searchParams.get("from"));
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
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
      <AuthBrandPanel title="We'll send a reset link to your email." />

      <div className="flex flex-col justify-center bg-ivory px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="font-serif text-xl tracking-[0.12em]">
            <span className="text-choc">Prudent</span>{" "}
            <span className="text-lightbr">Gabriel</span>
          </Link>
          <h2 className="mt-10 font-serif text-3xl font-medium text-choc">Forgot password</h2>
          <p className="mt-2 font-sans text-sm font-light text-text-mid">
            <Link href={backHref} className="text-nut hover:underline">
              Back to sign in
            </Link>
          </p>

          {isSubmitSuccessful ? (
            <p className="mt-8 font-sans text-sm font-light text-text-mid">
              If an account exists for this email, you will receive instructions shortly.
            </p>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
