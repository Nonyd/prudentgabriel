import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
  /** Lighter tone on dark backgrounds */
  light?: boolean;
}

export function SectionLabel({ children, className, light }: SectionLabelProps) {
  return (
    <span
      className={cn(
        "font-body text-[10px] font-medium uppercase tracking-[0.25em]",
        light ? "text-white/50" : "text-olive",
        className,
      )}
    >
      {children}
    </span>
  );
}
