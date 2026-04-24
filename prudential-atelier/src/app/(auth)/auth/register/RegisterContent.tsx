"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/validations/auth";
import { Button } from "@/components/ui/Button";

export function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refFromUrl = searchParams.get("ref") ?? "";

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
    router.push("/auth/login?registered=1");
    router.refresh();
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[40%_60%]">
      <div className="relative hidden flex-col justify-between bg-olive p-12 text-white lg:flex">
        <Link href="/" className="inline-block" style={{ filter: "brightness(0) invert(1)" }}>
          <Image src="/images/logo.svg" alt="Prudent Gabriel" width={48} height={48} />
        </Link>
        <div>
          <p className="max-w-sm font-display text-[32px] font-normal italic leading-tight">
            Join the inner circle — orders, wishlists, and bespoke consultations.
          </p>
        </div>
        <p className="font-body text-[11px] text-white/30">© {new Date().getFullYear()} Prudent Gabriel</p>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-8 inline-block lg:hidden" style={{ filter: "brightness(0)" }}>
            <Image src="/images/logo.svg" alt="Prudent Gabriel" width={36} height={36} />
          </Link>
          <h2 className="font-display text-[32px] text-black">Create Account.</h2>
          <p className="mt-2 font-body text-[14px] font-light text-dark-grey">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-olive hover:underline">
              Sign in
            </Link>
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            {errors.root && (
              <p className="font-body text-sm text-error" role="alert">
                {errors.root.message}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-label text-[10px] uppercase tracking-[0.15em] text-charcoal-mid">
                  First name
                </label>
                <input
                  className="mt-1 w-full border-0 border-b border-mid-grey bg-transparent py-2.5 font-body text-sm outline-none focus:border-olive"
                  {...register("firstName")}
                />
                {errors.firstName && (
                  <p className="mt-1 font-body text-xs text-error">{errors.firstName.message}</p>
                )}
              </div>
              <div>
                <label className="font-label text-[10px] uppercase tracking-[0.15em] text-charcoal-mid">
                  Last name
                </label>
                <input
                  className="mt-1 w-full border-0 border-b border-mid-grey bg-transparent py-2.5 font-body text-sm outline-none focus:border-olive"
                  {...register("lastName")}
                />
                {errors.lastName && (
                  <p className="mt-1 font-body text-xs text-error">{errors.lastName.message}</p>
                )}
              </div>
            </div>
            <div>
              <label className="font-label text-[10px] uppercase tracking-[0.15em] text-charcoal-mid">Email</label>
              <input
                type="email"
                autoComplete="email"
                className="mt-1 w-full border-0 border-b border-mid-grey bg-transparent py-2.5 font-body text-sm outline-none focus:border-olive"
                {...register("email")}
              />
              {errors.email && <p className="mt-1 font-body text-xs text-error">{errors.email.message}</p>}
            </div>
            <div>
              <label className="font-label text-[10px] uppercase tracking-[0.15em] text-charcoal-mid">Phone</label>
              <input
                type="tel"
                className="mt-1 w-full border-0 border-b border-mid-grey bg-transparent py-2.5 font-body text-sm outline-none focus:border-olive"
                {...register("phone")}
              />
              {errors.phone && <p className="mt-1 font-body text-xs text-error">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="font-label text-[10px] uppercase tracking-[0.15em] text-charcoal-mid">
                Referral code (optional)
              </label>
              <input
                className="mt-1 w-full border-0 border-b border-mid-grey bg-transparent py-2.5 font-body text-sm outline-none focus:border-olive"
                {...register("referralCode")}
              />
            </div>
            <div>
              <label className="font-label text-[10px] uppercase tracking-[0.15em] text-charcoal-mid">Password</label>
              <input
                type="password"
                autoComplete="new-password"
                className="mt-1 w-full border-0 border-b border-mid-grey bg-transparent py-2.5 font-body text-sm outline-none focus:border-olive"
                {...register("password")}
              />
              {errors.password && (
                <p className="mt-1 font-body text-xs text-error">{errors.password.message}</p>
              )}
            </div>
            <div>
              <label className="font-label text-[10px] uppercase tracking-[0.15em] text-charcoal-mid">
                Confirm password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                className="mt-1 w-full border-0 border-b border-mid-grey bg-transparent py-2.5 font-body text-sm outline-none focus:border-olive"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="mt-1 font-body text-xs text-error">{errors.confirmPassword.message}</p>
              )}
            </div>
            <label className="flex items-start gap-2 font-body text-xs text-charcoal-mid">
              <input type="checkbox" className="mt-0.5" {...register("acceptTerms")} />
              <span>I accept the terms and conditions</span>
            </label>
            {errors.acceptTerms && (
              <p className="font-body text-xs text-error">{errors.acceptTerms.message}</p>
            )}
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Create account
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
