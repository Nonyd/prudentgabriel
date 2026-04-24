"use client";

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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-wine p-12 text-ivory lg:flex">
        <p className="font-label text-[11px] tracking-[0.2em] text-gold">Prudential Atelier</p>
        <div>
          <h1 className="font-display text-4xl font-medium italic leading-tight">Join the atelier</h1>
          <p className="mt-4 max-w-sm font-body text-sm text-ivory/80">
            Create an account for orders, wishlists, rewards, and bespoke consultations.
          </p>
        </div>
        <p className="font-body text-xs text-ivory/50">© {new Date().getFullYear()} Prudential Atelier</p>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <p className="font-label text-[11px] tracking-[0.2em] text-gold lg:hidden">Prudential Atelier</p>
          <h2 className="mt-2 font-display text-3xl text-charcoal">Register</h2>
          <p className="mt-2 font-body text-sm text-charcoal-light">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-wine underline-offset-4 hover:underline">
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
                  className="mt-2 w-full border border-border bg-cream px-3 py-2.5 font-body text-sm outline-none focus:border-wine"
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
                  className="mt-2 w-full border border-border bg-cream px-3 py-2.5 font-body text-sm outline-none focus:border-wine"
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
                className="mt-2 w-full border border-border bg-cream px-3 py-2.5 font-body text-sm outline-none focus:border-wine"
                {...register("email")}
              />
              {errors.email && <p className="mt-1 font-body text-xs text-error">{errors.email.message}</p>}
            </div>
            <div>
              <label className="font-label text-[10px] uppercase tracking-[0.15em] text-charcoal-mid">Phone</label>
              <input
                type="tel"
                className="mt-2 w-full border border-border bg-cream px-3 py-2.5 font-body text-sm outline-none focus:border-wine"
                {...register("phone")}
              />
              {errors.phone && <p className="mt-1 font-body text-xs text-error">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="font-label text-[10px] uppercase tracking-[0.15em] text-charcoal-mid">
                Referral code (optional)
              </label>
              <input
                className="mt-2 w-full border border-border bg-cream px-3 py-2.5 font-body text-sm outline-none focus:border-wine"
                {...register("referralCode")}
              />
            </div>
            <div>
              <label className="font-label text-[10px] uppercase tracking-[0.15em] text-charcoal-mid">Password</label>
              <input
                type="password"
                autoComplete="new-password"
                className="mt-2 w-full border border-border bg-cream px-3 py-2.5 font-body text-sm outline-none focus:border-wine"
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
                className="mt-2 w-full border border-border bg-cream px-3 py-2.5 font-body text-sm outline-none focus:border-wine"
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
