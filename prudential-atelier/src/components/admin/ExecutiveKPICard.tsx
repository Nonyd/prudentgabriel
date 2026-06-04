import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExecutiveKPICardProps {
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean | null;
  icon: LucideIcon;
  iconBg: string;
  className?: string;
}

export function ExecutiveKPICard({
  label,
  value,
  trend,
  trendUp,
  icon: Icon,
  iconBg,
  className,
}: ExecutiveKPICardProps) {
  return (
    <div className={cn("card-surface p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-text-light">{label}</p>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-sm", iconBg)}>
          <Icon className="h-4 w-4 text-choc/70" strokeWidth={1.5} />
        </div>
      </div>
      <p className="mt-4 font-serif text-[36px] font-medium leading-none text-choc">{value}</p>
      {trend ? (
        <p
          className={cn(
            "mt-3 font-sans text-[11px]",
            trendUp === true && "text-success",
            trendUp === false && "text-danger",
            trendUp == null && "text-text-mid",
          )}
        >
          {trendUp === true ? "↑ " : trendUp === false ? "↓ " : ""}
          {trend}
        </p>
      ) : null}
    </div>
  );
}
