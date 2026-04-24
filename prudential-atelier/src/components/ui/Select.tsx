"use client";

import { useId } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectFieldProps {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

export function SelectField({ label, value, onValueChange, options, placeholder, error, disabled }: SelectFieldProps) {
  const uid = useId();
  const errorId = `${uid}-error`;

  return (
    <div className="relative pb-1">
      <span
        className={cn(
          "pointer-events-none absolute left-0 top-0 z-[1] origin-left font-body text-xs transition-all duration-200",
          value ? "text-wine" : "text-charcoal-light",
        )}
      >
        {label}
      </span>
      <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectPrimitive.Trigger
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "mt-5 flex h-11 w-full items-center justify-between border-0 border-b border-border bg-transparent pb-1 pl-0 pr-6 pt-0 font-body text-sm text-charcoal outline-none",
            "focus:border-b-2 focus:border-wine data-[state=open]:border-b-2 data-[state=open]:border-wine",
            error && "border-b-2 border-[var(--error)]",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder ?? "Select…"} />
          <SelectPrimitive.Icon>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-charcoal-light" aria-hidden />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            style={{ animation: "slideDown 0.15s ease-out" }}
            className="z-50 max-h-[280px] overflow-y-auto rounded-sm border border-border bg-cream shadow-lg"
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((o) => (
                <SelectPrimitive.Item
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center py-2.5 pl-8 pr-4 font-body text-sm text-charcoal outline-none",
                    "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40",
                    "data-[highlighted]:bg-wine/10 data-[highlighted]:text-wine",
                  )}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-4 w-4 text-gold" strokeWidth={2} />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error ? (
        <p id={errorId} role="alert" className="mt-1 font-body text-xs text-[var(--error)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
