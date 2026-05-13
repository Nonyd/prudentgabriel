"use client";

export function UploadProgressBar({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <div className="w-full space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EBEBEA]">
        <div
          className="h-full rounded-full bg-[#37392d] transition-[width] duration-150 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <p className="font-body text-[10px] text-[#6B6B68]">{value}%</p>
    </div>
  );
}
