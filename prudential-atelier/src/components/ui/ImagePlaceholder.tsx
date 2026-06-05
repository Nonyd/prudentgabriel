import { cn } from "@/lib/utils";

export function ImagePlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center bg-choc", className)}>
      <span
        style={{
          fontFamily: "Cormorant Garamond, serif",
          fontSize: "32px",
          color: "rgba(226, 209, 194, 0.2)",
          letterSpacing: "0.1em",
          fontWeight: 300,
        }}
      >
        PG
      </span>
    </div>
  );
}
