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
    <div className={cn("card-surface min-h-[120px] p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="kpi-label font-sans font-semibold uppercase text-text-light">{label}</p>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-sm", iconBg)}>
          <Icon className="h-4 w-4 text-choc/70" strokeWidth={1.5} />
        </div>
      </div>
      <p className="kpi-value mt-3 leading-none tabular-nums text-choc">{value}</p>
      {trend ? (
        <p
          className={cn(
            "kpi-trend mt-1.5 font-sans",
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
