"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signOut, getSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/validations/auth";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";

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
    <div className="mx-auto mt-[15vh] w-full max-w-sm px-6">
      <div className="text-center">
        <Image src="/images/logo.svg" alt="" width={40} height={40} className="mx-auto object-contain" style={{ filter: "brightness(0)" }} />
        <p className="mt-3 font-body text-[11px] font-medium uppercase tracking-[0.2em] text-black">Prudent Gabriel</p>
        <p className="mt-1 font-body text-xs font-light text-[#6B6B68]">Admin Portal</p>
      </div>
      <div className="my-8 h-px bg-[#E8E8E4]" />
      <h1 className="mb-6 font-display text-[28px] text-black">Sign In</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {errors.root ? (
          <p className="text-center font-body text-[13px] text-[#8B1A1A]" role="alert">
            {errors.root.message}
          </p>
        ) : null}
        <Input label="Email Address" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <Input label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center bg-olive font-body text-xs font-medium uppercase tracking-[0.15em] text-white transition-opacity disabled:opacity-60"
        >
          {isSubmitting ? <Spinner size="sm" className="border-white border-t-transparent" /> : "Sign In"}
        </button>
      </form>
      <p className="mt-8 text-center">
        <Link href="/" className="font-body text-[11px] text-[#6B6B68] transition-colors hover:text-olive">
          ← Back to Website
        </Link>
      </p>
    </div>
  );
}
