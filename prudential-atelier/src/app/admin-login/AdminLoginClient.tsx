"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signOut, getSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/validations/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export function AdminLoginClient() {
  const router = useRouter();
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
      setError("root", { message: "Invalid credentials. Please try again." });
      return;
    }
    const session = await getSession();
    const role = session?.user?.role;
    if (role === "ADMIN" || role === "SUPER_ADMIN") {
      router.push("/admin");
      router.refresh();
      return;
    }
    if (role === "CUSTOMER") {
      await signOut({ redirect: false });
      setError("root", { message: "You do not have admin access." });
      return;
    }
    setError("root", { message: "Invalid credentials. Please try again." });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar-bg px-6 py-12">
      <div className="w-full max-w-md rounded-lg border border-lightbr/30 bg-sidebar-bg p-8 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <Logo variant="white" size="md" themeAdaptive={false} href={undefined} />
          <p className="mt-2 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr/70">
            Operations Suite
          </p>
        </div>

        <h1 className="mt-8 font-serif text-2xl font-medium text-cream">Admin Sign In</h1>
        <p className="mt-2 font-sans text-xs font-light text-cream/70">
          Email and password only — staff accounts only.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
          {errors.root ? (
            <p className="font-sans text-[13px] text-danger" role="alert">
              {errors.root.message}
            </p>
          ) : null}
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            className="[&_input]:border-lightbr/30 [&_input]:bg-bg/10 [&_input]:text-text-dark [&_label]:text-cream/80"
            {...register("email")}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            className="[&_input]:border-lightbr/30 [&_input]:bg-bg/10 [&_input]:text-text-dark [&_label]:text-cream/80"
            {...register("password")}
          />
          <Button type="submit" loading={isSubmitting} className="w-full">
            Sign In
          </Button>
        </form>

        <p className="mt-8 text-center">
          <Link
            href="/"
            className="font-sans text-[11px] text-lightbr transition-colors hover:text-cream"
          >
            ← Back to website
          </Link>
        </p>
      </div>
    </div>
  );
}
