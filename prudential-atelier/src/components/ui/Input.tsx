"use client";

import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  hint?: string;
}

const InputInner = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, suffix, hint, className, type, disabled, id: idProp, onFocus, onBlur, onChange, value, defaultValue, ...props }, ref) => {
    const uid = useId();
    const id = idProp ?? uid;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;
    const [showPw, setShowPw] = useState(false);
    const [focused, setFocused] = useState(false);
    const [inner, setInner] = useState(defaultValue != null ? String(defaultValue) : "");
    const isPassword = type === "password";
    const inputType = isPassword && showPw ? "text" : type;

    const strVal = value !== undefined ? String(value) : inner;
    const floated = focused || strVal.length > 0;

    const describedBy = [error ? errorId : null, !error && hint ? hintId : null].filter(Boolean).join(" ") || undefined;

    return (
      <div className={cn("relative pb-1", className)}>
        <div className="relative">
          {icon ? <span className="pointer-events-none absolute left-0 top-3.5 text-charcoal-light">{icon}</span> : null}
          <label
            htmlFor={id}
            className={cn(
              "pointer-events-none absolute left-0 origin-left font-body text-sm transition-all duration-200 ease-out",
              icon ? "left-7" : "left-0",
              floated ? "top-0 -translate-y-5 scale-75 text-wine" : "top-3.5 translate-y-0 scale-100 text-charcoal-light",
            )}
          >
            {label}
          </label>
          <input
            ref={ref}
            id={id}
            type={inputType}
            disabled={disabled}
            value={value}
            defaultValue={defaultValue}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            onChange={(e) => {
              if (value === undefined) setInner(e.target.value);
              onChange?.(e);
            }}
            className={cn(
              "w-full border-0 border-b border-border bg-transparent pb-1 pt-5 font-body text-base text-charcoal outline-none transition-[border-color] duration-200",
              "focus:border-b-2 focus:border-wine",
              error && "border-b-2 border-[var(--error)] focus:border-[var(--error)]",
              icon ? "pl-7 pr-0" : "px-0",
              (isPassword || suffix) && "pr-10",
              disabled && "cursor-not-allowed opacity-50",
            )}
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              tabIndex={-1}
              className="absolute right-0 top-3 text-charcoal-light hover:text-wine"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          ) : suffix ? (
            <span className="absolute right-0 top-3">{suffix}</span>
          ) : null}
        </div>
        {error ? (
          <p id={errorId} role="alert" className="mt-1 font-body text-xs text-[var(--error)]">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="mt-1 font-body text-xs text-charcoal-light">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

InputInner.displayName = "Input";

export default InputInner;
export { InputInner as Input };
