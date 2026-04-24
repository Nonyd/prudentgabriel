"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@/validations/auth";
import { Button } from "@/components/ui/Button";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    reset({ token, password: "", confirmPassword: "" });
  }, [token, reset]);

  const onSubmit = async (data: ResetPasswordInput) => {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError("root", { message: (json as { error?: string }).error ?? "Reset failed" });
      return;
    }
    router.push("/auth/login");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-center bg-wine p-12 text-ivory lg:flex">
        <p className="font-label text-[11px] tracking-[0.2em] text-gold">Prudential Atelier</p>
        <h1 className="mt-6 font-display text-4xl font-medium italic">New password</h1>
      </div>
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <h2 className="font-display text-3xl text-charcoal">Set a new password</h2>
          <p className="mt-2 font-body text-sm text-charcoal-light">
            <Link href="/auth/login" className="text-wine hover:underline">
              Back to sign in
            </Link>
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
            <input type="hidden" {...register("token")} />
            {errors.root && (
              <p className="font-body text-sm text-error" role="alert">
                {errors.root.message}
              </p>
            )}
            <div>
              <label className="font-label text-[10px] uppercase tracking-[0.15em] text-charcoal-mid">
                New password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                className="mt-2 w-full border border-border bg-cream px-4 py-3 font-body text-sm outline-none focus:border-wine"
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
                className="mt-2 w-full border border-border bg-cream px-4 py-3 font-body text-sm outline-none focus:border-wine"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="mt-1 font-body text-xs text-error">{errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Update password
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
