"use client";

import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import {
  hardNavigate,
  isSignInFailure,
  resolveStaffPortalRedirect,
  waitForClientSession,
} from "@/lib/client-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { loginSchema, type LoginInput } from "@/validations/auth";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

function StaffField({
  id,
  label,
  type = "text",
  autoComplete,
  error,
  registration,
  onClearError,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm<LoginInput>>["register"]>;
  onClearError: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-mid)]"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={inputType}
          autoComplete={autoComplete}
          className={cn(
            "w-full rounded-[3px] border-[0.5px] border-[var(--sand)] bg-input-bg px-4 py-3 font-sans text-[13px] text-text-dark outline-none transition-colors focus:border-[#442913]",
            error && "border-[#8B2020]",
            isPassword && "pr-11",
          )}
          {...registration}
          onChange={(e) => {
            onClearError();
            void registration.onChange(e);
          }}
        />
        {isPassword ? (
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-light)]"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1.5 font-sans text-[11px] text-[#8B2020]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function StaffLoginClient() {
  const searchParams = useSearchParams();
  const emailId = useId();
  const passwordId = useId();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (searchParams.get("error") === "no_staff_access") {
      setError("root", {
        message:
          "This account does not have staff portal access. Use the client login or contact your manager.",
      });
    }
  }, [searchParams, setError]);

  const onSubmit = async (data: LoginInput) => {
    try {
      const res = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (isSignInFailure(res)) {
        setError("root", { message: "Invalid credentials. Please try again." });
        return;
      }

      const session = await waitForClientSession({
        maxAttempts: 20,
        delayMs: 100,
        until: (current) => Boolean(current?.user?.id && current?.user?.role),
      });

      const destination = resolveStaffPortalRedirect(session);
      if (!destination) {
        await signOut({ redirect: false });
        setError("root", {
          message:
            "This account does not have staff portal access. Use the client login or contact your manager.",
        });
        return;
      }

      hardNavigate(destination);
    } catch {
      setError("root", { message: "An error occurred. Please try again." });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-[420px] max-w-full rounded-xl border-[0.5px] border-[var(--sand)] bg-[#F7F2EC] px-10 py-12">
        <div className="flex flex-col items-center text-center">
          <Logo variant="dark" size="xl" themeAdaptive={false} href={undefined} />
          <div className="mx-auto my-4 h-px w-10 bg-[#C9A84C]" aria-hidden />
          <p className="mb-6 font-sans text-[9px] font-semibold uppercase tracking-[0.24em] text-[var(--lightbr)]">
            STAFF PORTAL
          </p>
        </div>

        <h1 className="mb-1 text-center font-serif text-[32px] font-normal text-[#442913]">Staff Sign In</h1>
        <p className="mb-8 text-center font-sans text-xs font-light text-[var(--text-light)]">
          For production staff only
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {errors.root ? (
            <p
              className="mb-4 rounded-[4px] px-3.5 py-2.5 font-sans text-xs text-[#8B2020]"
              style={{ background: "rgba(139,32,32,0.06)" }}
              role="alert"
            >
              {errors.root.message}
            </p>
          ) : null}

          <StaffField
            id={emailId}
            label="EMAIL"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            registration={register("email")}
            onClearError={() => {
              if (errors.email) clearErrors("email");
              if (errors.root) clearErrors("root");
            }}
          />

          <StaffField
            id={passwordId}
            label="PASSWORD"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            registration={register("password")}
            onClearError={() => {
              if (errors.password) clearErrors("password");
              if (errors.root) clearErrors("root");
            }}
          />

          <p className="text-right">
            <Link
              href="/auth/forgot-password?from=staff"
              className="font-sans text-[11px] font-light text-[var(--text-mid)] transition-colors hover:text-[#442913]"
            >
              Forgot password?
            </Link>
          </p>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#442913] px-4 py-4 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E2D1C2] disabled:opacity-70"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                SIGNING IN...
              </>
            ) : (
              "SIGN IN"
            )}
          </button>
        </form>

        <p className="mt-8 text-center">
          <Link href="/" className="font-sans text-[11px] text-[var(--text-light)] hover:text-[var(--text-mid)]">
            ← Back to website
          </Link>
        </p>
      </div>
    </div>
  );
}
