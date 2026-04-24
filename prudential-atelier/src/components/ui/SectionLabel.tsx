import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
  light?: boolean;
}

export function SectionLabel({ children, className, light }: SectionLabelProps) {
  return (
    <div className={cn("flex items-center justify-center gap-3", className)}>
      <div className={cn("h-px w-10 flex-shrink-0", light ? "bg-gold/60" : "bg-gold")} />
      <span
        className={cn(
          "font-label text-[11px] uppercase tracking-[0.2em]",
          light ? "text-gold" : "text-gold",
        )}
      >
        {children}
      </span>
      <div className={cn("h-px w-10 flex-shrink-0", light ? "bg-gold/60" : "bg-gold")} />
    </div>
  );
}
