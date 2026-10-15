"use client";

import {
  MEASURE_INTRO_TIPS,
  MEASURE_INTRO_TITLE,
} from "@/lib/measurement-guide";
import { cn } from "@/lib/utils";

/** A dress-form outline with the four lines most pieces are cut from. */
function MeasureDiagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 150 170"
      className={cn("h-auto w-full text-text-mid", className)}
      role="img"
      aria-label="Where to place the tape: across the shoulders, around the bust, the natural waist and the fullest part of the hips"
    >
      <path
        d="M60 8c-7 0-11 5-11 11s4 11 11 11 11-5 11-11-4-11-11-11Zm-8 24c-11 2-22 6-26 10l-2 12c4 14 7 22 8 30-2 10-2 18 0 26 2 14 7 34 9 52h38c2-18 7-38 9-52 2-8 2-16 0-26 1-8 4-16 8-30l-2-12c-4-4-15-8-26-10-2 3-5 4-8 4s-6-1-8-4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.55"
      />
      {[
        { y: 44, label: "Shoulder", x1: 26, x2: 94 },
        { y: 66, label: "Bust", x1: 28, x2: 92 },
        { y: 88, label: "Waist", x1: 33, x2: 87 },
        { y: 112, label: "Hips", x1: 30, x2: 90 },
      ].map((l) => (
        <g key={l.label}>
          <line
            x1={l.x1}
            x2={l.x2}
            y1={l.y}
            y2={l.y}
            stroke="var(--choc)"
            strokeWidth="1.4"
            strokeDasharray="3 2.5"
          />
          <text
            x={l.x2 + 3}
            y={l.y + 3}
            fontSize="10.5"
            fill="currentColor"
            fontFamily="var(--font-jost), sans-serif"
            textAnchor="start"
          >
            {l.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * The "How to measure" panel every measurement form opens with. Collapsible so
 * a returning client is not made to scroll past it; open by default for a first set.
 */
export function MeasureGuide({
  defaultOpen = true,
  className,
}: {
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "bg-bg-surface group rounded-sm border border-sand/70 text-text-dark [&_summary::-webkit-details-marker]:hidden",
        className,
      )}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 font-sans text-[13px] font-medium tracking-wide text-choc">
        <span className="inline-flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 8h18v8H3z" />
            <path d="M7 8v3M11 8v4M15 8v3M19 8v4" />
          </svg>
          {MEASURE_INTRO_TITLE}
        </span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="h-4 w-4 shrink-0 text-text-light transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="measure-guide-body border-t border-sand/50 px-4 pb-4 pt-3">
        <div className="measure-guide-grid grid items-start gap-4">
          <ul className="space-y-1.5 font-body text-[13px] leading-6 text-text-mid">
            {MEASURE_INTRO_TIPS.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span
                  aria-hidden
                  className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-text-light"
                />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          <MeasureDiagram className="mx-auto max-w-[9rem]" />
        </div>
      </div>
    </details>
  );
}

/** The error line under a field; pair with aria-describedby on the input. */
export function FieldError({
  id,
  message,
}: {
  id: string;
  message?: string | null;
}) {
  if (!message) return null;
  return (
    <span
      id={id}
      className="mt-1 block font-sans text-[12px] font-medium leading-5 text-error"
    >
      {message}
    </span>
  );
}

/** The summary above Save: what went wrong, in one sentence, announced to screen readers. */
export function FormErrorSummary({
  message,
  className,
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn(
        "rounded-sm border border-error/40 bg-error-soft px-3 py-2.5 font-sans text-[13px] leading-5 text-error",
        className,
      )}
    >
      {message}
    </p>
  );
}
