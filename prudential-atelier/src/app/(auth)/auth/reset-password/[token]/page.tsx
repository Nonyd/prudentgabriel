"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@/validations/auth";
import { authApiErrorMessage, hardNavigate } from "@/lib/client-auth";
import { Button } from "@/components/ui/Button";

export default function ResetPasswordPage() {
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
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError("root", { message: authApiErrorMessage(json, "Reset failed") });
        return;
      }
      await signOut({ redirect: false }).catch(() => undefined);
      hardNavigate("/auth/login");
    } catch {
      setError("root", { message: "Reset failed" });
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-center bg-choc p-12 text-cream lg:flex">
        <p className="font-label text-[11px] tracking-[0.2em] text-gold">Prudential Atelier</p>
        <h1 className="mt-6 font-display text-4xl font-medium italic">New password</h1>
      </div>
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <h2 className="font-display text-3xl text-charcoal">Set a new password</h2>
          <p className="mt-2 font-body text-sm text-charcoal-light">
            <Link href="/auth/login" className="text-choc hover:underline">
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
                className="mt-2 w-full border border-border bg-cream px-4 py-3 font-body text-sm outline-none focus:border-choc"
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
                className="mt-2 w-full border border-border bg-cream px-4 py-3 font-body text-sm outline-none focus:border-choc"
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
