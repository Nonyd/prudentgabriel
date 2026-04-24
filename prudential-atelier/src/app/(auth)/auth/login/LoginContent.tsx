"use client";

import Image from "next/image";
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
    <div className="grid min-h-screen lg:grid-cols-[40%_60%]">
      <div className="relative hidden flex-col justify-between bg-olive p-12 text-white lg:flex">
        <Link href="/" className="inline-block" style={{ filter: "brightness(0) invert(1)" }}>
          <Image src="/images/logo.svg" alt="Prudent Gabriel" width={48} height={48} />
        </Link>
        <div>
          <p className="max-w-sm font-display text-[32px] font-normal italic leading-tight">
            Fashion is the
            <br />
            armour to survive
            <br />
            everyday life.
          </p>
          <p className="mt-6 font-body text-[12px] text-white/50">— Bill Cunningham</p>
        </div>
        <p className="font-body text-[11px] text-white/30">© {new Date().getFullYear()} Prudent Gabriel</p>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-8 inline-block lg:hidden" style={{ filter: "brightness(0)" }}>
            <Image src="/images/logo.svg" alt="Prudent Gabriel" width={36} height={36} />
          </Link>
          <h2 className="font-display text-[32px] text-black">Welcome Back.</h2>
          <p className="mt-2 font-body text-[14px] font-light text-dark-grey">
            New here?{" "}
            <Link href="/auth/register" className="text-olive hover:underline">
              Create an account
            </Link>
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
            {errors.root && (
              <p className="font-body text-sm text-error" role="alert">
                {errors.root.message}
              </p>
            )}
            <div>
              <label htmlFor="email" className="font-body text-[10px] font-medium uppercase tracking-[0.15em] text-dark-grey">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="mt-1 w-full border-0 border-b border-mid-grey bg-transparent py-2.5 font-body text-sm text-charcoal outline-none transition-colors focus:border-olive"
                {...register("email")}
              />
              {errors.email && <p className="mt-1 font-body text-xs text-error">{errors.email.message}</p>}
            </div>
            <div>
              <label htmlFor="password" className="font-body text-[10px] font-medium uppercase tracking-[0.15em] text-dark-grey">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="mt-1 w-full border-0 border-b border-mid-grey bg-transparent py-2.5 font-body text-sm text-charcoal outline-none transition-colors focus:border-olive"
                {...register("password")}
              />
              {errors.password && <p className="mt-1 font-body text-xs text-error">{errors.password.message}</p>}
            </div>
            <div className="flex items-center justify-between">
              <Link href="/auth/forgot-password" className="font-body text-[13px] font-light text-charcoal hover:text-olive">
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
