"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/validations/auth";
import { Button } from "@/components/ui/Button";

export function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/account";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    const res = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
    if (res?.error) {
      setError("root", { message: "Invalid email or password" });
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-wine p-12 text-ivory lg:flex">
        <p className="font-label text-[11px] tracking-[0.2em] text-gold">Prudential Atelier</p>
        <div>
          <h1 className="font-display text-4xl font-medium italic leading-tight">Welcome back</h1>
          <p className="mt-4 max-w-sm font-body text-sm text-ivory/80">
            Sign in to manage orders, wishlists, and your atelier profile.
          </p>
        </div>
        <p className="font-body text-xs text-ivory/50">© {new Date().getFullYear()} Prudential Atelier</p>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <p className="font-label text-[11px] tracking-[0.2em] text-gold lg:hidden">Prudential Atelier</p>
          <h2 className="mt-2 font-display text-3xl text-charcoal">Sign in</h2>
          <p className="mt-2 font-body text-sm text-charcoal-light">
            New here?{" "}
            <Link href="/auth/register" className="text-wine underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            {errors.root && (
              <p className="font-body text-sm text-error" role="alert">
                {errors.root.message}
              </p>
            )}
            <div>
              <label htmlFor="email" className="font-label text-[10px] uppercase tracking-[0.15em] text-charcoal-mid">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="mt-2 w-full border border-border bg-cream px-4 py-3 font-body text-sm text-charcoal outline-none transition-colors focus:border-wine"
                {...register("email")}
              />
              {errors.email && (
                <p className="mt-1 font-body text-xs text-error">{errors.email.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="font-label text-[10px] uppercase tracking-[0.15em] text-charcoal-mid">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="mt-2 w-full border border-border bg-cream px-4 py-3 font-body text-sm text-charcoal outline-none transition-colors focus:border-wine"
                {...register("password")}
              />
              {errors.password && (
                <p className="mt-1 font-body text-xs text-error">{errors.password.message}</p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <Link href="/auth/forgot-password" className="font-body text-xs text-wine hover:underline">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
