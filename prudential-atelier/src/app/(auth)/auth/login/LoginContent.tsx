"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { hardNavigate, isSignInFailure, waitForClientSession } from "@/lib/client-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/validations/auth";
import { Button } from "@/components/ui/Button";

export function LoginContent() {
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
    if (isSignInFailure(res)) {
      setError("root", { message: "Invalid email or password" });
      return;
    }
    const session = await waitForClientSession();
    if (!session?.user?.id) {
      setError("root", { message: "Signed in, but the session did not load. Please try again." });
      return;
    }
    hardNavigate(callbackUrl);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <Image
          src="https://images.unsplash.com/photo-1496747611176-843222e1ad94?w=1200&q=80"
          alt="Prudential Atelier"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-choc/50" />
        <div className="absolute bottom-12 left-12 max-w-sm text-cream">
          <p className="font-serif text-3xl font-medium leading-tight">
            Where culture meets couture.
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
          <h2 className="mt-10 font-serif text-3xl font-medium text-choc">Welcome back</h2>
          <p className="mt-2 font-sans text-sm font-light text-text-mid">
            New here?{" "}
            <Link href="/register" className="text-nut hover:underline">
              Create an account
            </Link>
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            {errors.root ? (
              <p className="font-sans text-sm text-danger" role="alert">
                {errors.root.message}
              </p>
            ) : null}
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
                Password
              </span>
              <input
                type="password"
                autoComplete="current-password"
                className="input-field"
                {...register("password")}
              />
              {errors.password ? (
                <p className="mt-1 font-sans text-xs text-danger">{errors.password.message}</p>
              ) : null}
            </label>
            <div className="flex justify-end">
              <Link href="/auth/forgot-password" className="font-sans text-xs text-text-mid hover:text-nut">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Sign in
            </Button>
          </form>

          <Button
            type="button"
            variant="ghost-light"
            className="mt-4 w-full"
            onClick={() => void signIn("google", { callbackUrl })}
          >
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}
