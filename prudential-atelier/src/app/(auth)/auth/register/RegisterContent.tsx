"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/validations/auth";
import { Button } from "@/components/ui/Button";

export function RegisterContent() {
  const searchParams = useSearchParams();
  const refFromUrl = searchParams.get("ref") ?? "";
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      referralCode: refFromUrl,
      acceptTerms: false,
    },
  });

  const onSubmit = async (data: RegisterInput) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (json as { error?: string | Record<string, unknown> }).error;
      const message =
        typeof err === "string" ? err : "Registration failed. Please check the form and try again.";
      setError("root", { message });
      return;
    }
    setSubmitted(true);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <Image
          src="https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=1200&q=80"
          alt="Prudential Atelier"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-choc/50" />
        <div className="absolute bottom-12 left-12 max-w-sm text-cream">
          <p className="font-serif text-3xl font-medium leading-tight">
            Join the inner circle — orders, wishlists, and atelier consultations.
          </p>
          <p className="mt-4 font-sans text-xs font-light text-cream/80">
            Prudential Atelier · Lagos, Nigeria
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-center bg-ivory px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="font-serif text-xl tracking-[0.12em]">
            <span className="text-choc">Prudent</span>{" "}
            <span className="text-lightbr">Gabriel</span>
          </Link>
          <h2 className="mt-10 font-serif text-3xl font-medium text-choc">Create account</h2>
          {submitted ? (
            <p className="mt-6 font-sans text-sm font-light text-text-mid">
              Check your email. If you already have an account, we&apos;ll send a reminder instead of
              creating a new one.
            </p>
          ) : (
            <>
          <p className="mt-2 font-sans text-sm font-light text-text-mid">
            Already have an account?{" "}
            <Link href="/login" className="text-nut hover:underline">
              Sign in
            </Link>
          </p>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="mt-8 max-h-[70vh] space-y-4 overflow-y-auto pr-1"
          >
            {errors.root ? (
              <p className="font-sans text-sm text-danger" role="alert">
                {errors.root.message}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-mid">
                  First name
                </span>
                <input className="input-field" {...register("firstName")} />
                {errors.firstName ? (
                  <p className="mt-1 font-sans text-xs text-danger">{errors.firstName.message}</p>
                ) : null}
              </label>
              <label className="block">
                <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-mid">
                  Last name
                </span>
                <input className="input-field" {...register("lastName")} />
                {errors.lastName ? (
                  <p className="mt-1 font-sans text-xs text-danger">{errors.lastName.message}</p>
                ) : null}
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-mid">
                Email
              </span>
              <input type="email" autoComplete="email" className="input-field" {...register("email")} />
              {errors.email ? (
                <p className="mt-1 font-sans text-xs text-danger">{errors.email.message}</p>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-mid">
                Phone
              </span>
              <input type="tel" className="input-field" {...register("phone")} />
              {errors.phone ? (
                <p className="mt-1 font-sans text-xs text-danger">{errors.phone.message}</p>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-mid">
                Referral code (optional)
              </span>
              <input className="input-field" {...register("referralCode")} />
            </label>

            <label className="block">
              <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-mid">
                Password
              </span>
              <input
                type="password"
                autoComplete="new-password"
                className="input-field"
                {...register("password")}
              />
              {errors.password ? (
                <p className="mt-1 font-sans text-xs text-danger">{errors.password.message}</p>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-mid">
                Confirm password
              </span>
              <input
                type="password"
                autoComplete="new-password"
                className="input-field"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword ? (
                <p className="mt-1 font-sans text-xs text-danger">{errors.confirmPassword.message}</p>
              ) : null}
            </label>

            <label className="flex items-start gap-2 font-sans text-xs text-text-mid">
              <input type="checkbox" className="mt-0.5" {...register("acceptTerms")} />
              <span>I accept the terms and conditions</span>
            </label>
            {errors.acceptTerms ? (
              <p className="font-sans text-xs text-danger">{errors.acceptTerms.message}</p>
            ) : null}

            <Button type="submit" className="w-full" loading={isSubmitting}>
              Create account
            </Button>
          </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
