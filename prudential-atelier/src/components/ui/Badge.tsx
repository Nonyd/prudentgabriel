import { cn } from "@/lib/utils";

type BadgeVariant = "wine" | "gold" | "success" | "outline-gold" | "outline-wine" | "grey";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  wine: "bg-wine text-ivory",
  gold: "bg-gold text-charcoal",
  success: "bg-success text-ivory",
  "outline-gold": "border border-gold bg-transparent text-gold",
  "outline-wine": "border border-wine bg-transparent text-wine",
  grey: "bg-charcoal/10 text-charcoal-mid",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[9px] tracking-[0.1em]",
  md: "px-2.5 py-0.5 text-[10px] tracking-[0.12em]",
};

export function Badge({ children, variant = "wine", size = "md", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm",
        "font-label uppercase",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
