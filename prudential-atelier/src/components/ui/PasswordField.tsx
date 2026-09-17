"use client";

import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type PasswordFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  error?: string;
};

/**
 * Boxed password input with show/hide eye. Pass `className` to match
 * `input-field`, sand-border, or underline styles used around the site.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ className, error, id: idProp, disabled, ...props }, ref) => {
    const uid = useId();
    const id = idProp ?? uid;
    const [show, setShow] = useState(false);

    return (
      <div className="relative w-full">
        <input
          ref={ref}
          id={id}
          type={show ? "text" : "password"}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          autoComplete={props.autoComplete ?? "current-password"}
          className={cn(className, "pr-10")}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-charcoal-light hover:text-choc disabled:opacity-40"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
        {error ? (
          <p role="alert" className="mt-1 font-body text-xs text-[var(--error)]">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

PasswordField.displayName = "PasswordField";
