"use client";

/**
 * Shown while a file is on its way up. `value` is 0–100, or null when nothing is uploading.
 * At 100% the bytes have arrived but the server is still saving, so it says so.
 */
export function UploadProgressBar({
  value,
  label,
  tone = "admin",
  className,
}: {
  value: number | null;
  label?: string;
  tone?: "admin" | "storefront";
  className?: string;
}) {
  if (value === null) return null;
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const finishing = pct >= 100;
  const status = finishing ? "Finishing upload…" : `Uploading… ${pct}%`;
  return (
    <div className={`w-full space-y-1 ${className ?? ""}`}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={label ?? "Upload progress"}
        className={`h-1.5 w-full overflow-hidden rounded-full ${tone === "storefront" ? "bg-choc/10" : "bg-[#EBEBEA]"}`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-150 ease-out ${
            tone === "storefront" ? "bg-choc" : "bg-[#37392d]"
          } ${finishing ? "animate-pulse" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="font-body text-10px text-text-mid" aria-live="polite">
        {label ? `${label} · ${status}` : status}
      </p>
    </div>
  );
}
