"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useLogoSettings } from "@/components/ui/LogoProvider";
import { useTheme } from "@/components/ui/ThemeProvider";

const WIDTHS = { sm: 120, md: 160, lg: 200 } as const;

export type LogoProps = {
  variant?: "dark" | "white";
  size?: keyof typeof WIDTHS;
  /** When false, always use `variant`. When true (default), logo swaps with theme. */
  themeAdaptive?: boolean;
  /** When false, wordmark omits the "/ ATELIER" subline (render separately if needed). */
  showSubline?: boolean;
  wordmarkTitleClassName?: string;
  className?: string;
  href?: string;
};

function WordmarkFallback({
  size,
  tone,
  showSubline,
  wordmarkTitleClassName,
  className,
}: {
  size: keyof typeof WIDTHS;
  tone: "dark" | "white";
  showSubline?: boolean;
  wordmarkTitleClassName?: string;
  className?: string;
}) {
  const primary = tone === "white" ? "var(--cream)" : "var(--text-primary)";
  const titleSize = size === "lg" ? "18px" : size === "md" ? "16px" : "14px";

  return (
    <span className={cn("block text-center uppercase", className)}>
      <span
        className={cn("block font-serif font-medium tracking-[0.16em]", wordmarkTitleClassName)}
        style={wordmarkTitleClassName ? undefined : { fontSize: titleSize, color: primary }}
      >
        PRUDENTIAL
      </span>
      {showSubline !== false ? (
        <span
          className="mt-0.5 block font-sans tracking-[0.28em]"
          style={{ fontSize: "9px", color: "var(--lightbr)" }}
        >
          / ATELIER
        </span>
      ) : null}
    </span>
  );
}

export function Logo({
  variant = "dark",
  size = "md",
  themeAdaptive = true,
  showSubline = true,
  wordmarkTitleClassName,
  className,
  href = "/",
}: LogoProps) {
  const { logoDark, logoWhite } = useLogoSettings();
  const { theme, mounted } = useTheme();

  const effectiveVariant: "dark" | "white" = themeAdaptive
    ? mounted
      ? theme === "light"
        ? "dark"
        : "white"
      : variant
    : variant;

  const url = effectiveVariant === "dark" ? logoDark : logoWhite;
  const width = WIDTHS[size];
  const height = Math.round(width * 0.35);

  const inner = url ? (
    <Image
      src={url}
      alt="Prudential Atelier"
      width={width}
      height={height}
      className="h-auto w-auto object-contain"
      style={{ maxWidth: width, height: "auto" }}
      priority
    />
  ) : (
    <WordmarkFallback
      size={size}
      tone={effectiveVariant}
      showSubline={showSubline}
      wordmarkTitleClassName={wordmarkTitleClassName}
    />
  );

  if (href) {
    return (
      <Link href={href} className={cn("group inline-block transition-opacity hover:opacity-85", className)}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
