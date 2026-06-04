"use client";

import { useEffect, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import {
  loginSchema,
  registerModalSchema,
  type LoginInput,
  type RegisterInput,
  type RegisterModalInput,
} from "@/validations/auth";
import { useAuthModalStore } from "@/store/authModalStore";
import { Logo } from "@/components/ui/Logo";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function ModalShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-[420px] overflow-y-auto"
        style={{
          background: "var(--ivory)",
          borderRadius: "12px",
          padding: "48px 40px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 transition-opacity hover:opacity-70"
          style={{ color: "var(--text-light)" }}
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
        {children}
      </div>
    </div>
  );
}

function BrandHeader() {
  return (
    <div className="flex flex-col items-center text-center">
      <Logo variant="dark" size="sm" href={undefined} />
      <div
        style={{
          width: 40,
          height: 1,
          background: "#C9A84C",
          margin: "12px auto 0",
        }}
      />
    </div>
  );
}

function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1" style={{ background: "var(--sand)" }} />
      <span
        className="shrink-0"
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: "11px",
          color: "var(--text-light)",
        }}
      >
        OR
      </span>
      <div className="h-px flex-1" style={{ background: "var(--sand)" }} />
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "10px",
  fontWeight: 600,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--text-mid)",
};

const inputClass =
  "w-full border bg-white text-choc outline-none focus:border-lightbr";
const inputStyle: React.CSSProperties = {
  border: "0.5px solid var(--sand)",
  borderRadius: "4px",
  padding: "12px 16px",
  fontFamily: "var(--font-ui)",
  fontSize: "13px",
};

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const callbackUrl = useAuthModalStore((s) => s.callbackUrl);
  const setView = useAuthModalStore((s) => s.setView);

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
    onSuccess();
  };

  return (
    <>
      <h2
        className="mt-6 text-center"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "28px",
          fontWeight: 400,
          color: "var(--choc)",
        }}
      >
        Welcome back
      </h2>
      <p
        className="mt-2 text-center"
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: "12px",
          fontWeight: 300,
          color: "var(--text-light)",
        }}
      >
        Sign in to your atelier account.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
        {errors.root ? (
          <p
            className="text-center text-sm"
            style={{ color: "var(--danger)", fontFamily: "var(--font-ui)" }}
            role="alert"
          >
            {errors.root.message}
          </p>
        ) : null}
        <label className="block">
          <span className="mb-2 block" style={labelStyle}>
            Email
          </span>
          <input
            type="email"
            autoComplete="email"
            className={inputClass}
            style={inputStyle}
            {...register("email")}
          />
          {errors.email ? (
            <p className="mt-1 font-sans text-xs text-danger">{errors.email.message}</p>
          ) : null}
        </label>
        <label className="block">
          <span className="mb-2 block" style={labelStyle}>
            Password
          </span>
          <input
            type="password"
            autoComplete="current-password"
            className={inputClass}
            style={inputStyle}
            {...register("password")}
          />
          {errors.password ? (
            <p className="mt-1 font-sans text-xs text-danger">{errors.password.message}</p>
          ) : null}
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full uppercase transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{
            background: "#6B1C2A",
            color: "white",
            fontFamily: "var(--font-ui)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.18em",
            padding: "16px",
            borderRadius: "4px",
          }}
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <OrDivider />

      <button
        type="button"
        onClick={() => void signIn("google", { callbackUrl })}
        className="flex w-full items-center justify-center gap-3 transition-opacity hover:opacity-90"
        style={{
          border: "0.5px solid var(--sand)",
          background: "white",
          fontFamily: "var(--font-ui)",
          fontSize: "13px",
          color: "var(--choc)",
          borderRadius: "4px",
          padding: "14px",
        }}
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <p
        className="mt-8 text-center"
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: "12px",
        }}
      >
        <span style={{ color: "var(--text-light)" }}>New here? </span>
        <button
          type="button"
          onClick={() => setView("register")}
          className="underline"
          style={{ color: "var(--nut)" }}
        >
          Create an account
        </button>
      </p>
    </>
  );
}

function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const setView = useAuthModalStore((s) => s.setView);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterModalInput>({
    resolver: zodResolver(registerModalSchema),
    defaultValues: { acceptTerms: false, referralCode: "" },
  });

  const onSubmit = async (data: RegisterModalInput) => {
    const parts = data.name.trim().split(/\s+/);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ") || firstName;
    const payload: RegisterInput = {
      firstName,
      lastName,
      email: data.email,
      phone: data.phone,
      password: data.password,
      confirmPassword: data.confirmPassword,
      referralCode: data.referralCode,
      acceptTerms: data.acceptTerms,
    };

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (json as { error?: string | Record<string, unknown> }).error;
      const message =
        typeof err === "string" ? err : "Registration failed. Please check the form and try again.";
      setError("root", { message });
      return;
    }

    const signInRes = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
    if (signInRes?.error) {
      setView("login");
      return;
    }
    onSuccess();
  };

  return (
    <>
      <h2
        className="mt-6 text-center"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "28px",
          fontWeight: 400,
          color: "var(--choc)",
        }}
      >
        Create account
      </h2>
      <p
        className="mt-2 text-center"
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: "12px",
          fontWeight: 300,
          color: "var(--text-light)",
        }}
      >
        Join the Prudential Atelier circle.
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-8 max-h-[50vh] space-y-4 overflow-y-auto pr-1"
      >
        {errors.root ? (
          <p
            className="text-center text-sm"
            style={{ color: "var(--danger)", fontFamily: "var(--font-ui)" }}
            role="alert"
          >
            {errors.root.message}
          </p>
        ) : null}

        <label className="block">
          <span className="mb-2 block" style={labelStyle}>
            Name
          </span>
          <input className={inputClass} style={inputStyle} autoComplete="name" {...register("name")} />
          {errors.name ? (
            <p className="mt-1 font-sans text-xs text-danger">{errors.name.message}</p>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-2 block" style={labelStyle}>
            Email
          </span>
          <input
            type="email"
            autoComplete="email"
            className={inputClass}
            style={inputStyle}
            {...register("email")}
          />
          {errors.email ? (
            <p className="mt-1 font-sans text-xs text-danger">{errors.email.message}</p>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-2 block" style={labelStyle}>
            Phone
          </span>
          <input type="tel" className={inputClass} style={inputStyle} {...register("phone")} />
          {errors.phone ? (
            <p className="mt-1 font-sans text-xs text-danger">{errors.phone.message}</p>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-2 block" style={labelStyle}>
            Password
          </span>
          <input
            type="password"
            autoComplete="new-password"
            className={inputClass}
            style={inputStyle}
            {...register("password")}
          />
          {errors.password ? (
            <p className="mt-1 font-sans text-xs text-danger">{errors.password.message}</p>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-2 block" style={labelStyle}>
            Confirm password
          </span>
          <input
            type="password"
            autoComplete="new-password"
            className={inputClass}
            style={inputStyle}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p className="mt-1 font-sans text-xs text-danger">{errors.confirmPassword.message}</p>
          ) : null}
        </label>

        <label
          className="flex items-start gap-2"
          style={{ fontFamily: "var(--font-ui)", fontSize: "11px", color: "var(--text-mid)" }}
        >
          <input type="checkbox" className="mt-0.5" {...register("acceptTerms")} />
          <span>I accept the terms and conditions</span>
        </label>
        {errors.acceptTerms ? (
          <p className="font-sans text-xs text-danger">{errors.acceptTerms.message}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full uppercase transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{
            background: "#6B1C2A",
            color: "white",
            fontFamily: "var(--font-ui)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.18em",
            padding: "16px",
            borderRadius: "4px",
          }}
        >
          {isSubmitting ? "Creating…" : "Create account"}
        </button>
      </form>

      <p
        className="mt-6 text-center"
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: "12px",
        }}
      >
        <span style={{ color: "var(--text-light)" }}>Already have an account? </span>
        <button
          type="button"
          onClick={() => setView("login")}
          className="underline"
          style={{ color: "var(--nut)" }}
        >
          Sign in
        </button>
      </p>
    </>
  );
}

export function AuthModal() {
  const { isOpen, view, close } = useAuthModalStore();
  const { status, update } = useSession();

  const handleSuccess = useCallback(() => {
    close();
    void update();
  }, [close, update]);

  useEffect(() => {
    if (status === "authenticated" && isOpen) {
      close();
    }
  }, [status, isOpen, close]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <ModalShell onClose={close}>
      <BrandHeader />
      {view === "login" ? (
        <LoginForm onSuccess={handleSuccess} />
      ) : (
        <RegisterForm onSuccess={handleSuccess} />
      )}
    </ModalShell>
  );
}
