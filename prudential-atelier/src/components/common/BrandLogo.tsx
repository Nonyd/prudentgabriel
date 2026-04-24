import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/images/logo.png";

export type BrandLogoVariant = "default" | "multiply" | "admin" | "onDark";

type BrandLogoProps = {
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  /**
   * default — storefront: black mark on light; `dark:invert` for dark UI.
   * multiply — e.g. olive panels: white in the asset drops out against the background.
   * admin — always light-theme appearance (no invert); use inside `.admin-area`.
   * onDark — light mark on dark backgrounds (e.g. footer).
   */
  variant?: BrandLogoVariant;
  alt?: string;
};

export function BrandLogo({
  width,
  height,
  className,
  priority,
  variant = "default",
  alt = "Prudent Gabriel",
}: BrandLogoProps) {
  return (
    <Image
      src={LOGO_SRC}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={cn(
        "object-contain",
        variant === "default" && "dark:invert",
        variant === "multiply" && "mix-blend-multiply",
        variant === "onDark" && "brightness-0 invert",
        className,
      )}
    />
  );
}
