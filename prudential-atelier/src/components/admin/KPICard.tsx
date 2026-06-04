import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}

export function KPICard({ label, value, hint, className }: KPICardProps) {
  return (
    <div className={cn("card-surface p-5", className)}>
      <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-text-light">
        {label}
      </p>
      <p className="mt-3 font-serif text-3xl font-medium text-choc">{value}</p>
      {hint ? (
        <p className="mt-2 font-sans text-xs font-light text-text-mid">{hint}</p>
      ) : null}
    </div>
  );
}
