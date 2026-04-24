import { cn } from "@/lib/utils";

interface DividerProps {
  className?: string;
  ornament?: boolean;
}

export function Divider({ className, ornament = true }: DividerProps) {
  if (!ornament) {
    return <div className={cn("h-px w-full bg-border", className)} />;
  }

  return (
    <div className={cn("relative my-2 flex items-center gap-4", className)}>
      <div className="h-px flex-1 bg-border" />
      <span className="select-none text-xs leading-none text-gold">◆</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
