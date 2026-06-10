import Link from "next/link";

type AdminMaintenanceBannerProps = {
  isMaintenanceOn: boolean;
};

export function AdminMaintenanceBanner({ isMaintenanceOn }: AdminMaintenanceBannerProps) {
  if (!isMaintenanceOn) return null;

  return (
    <div
      className="sticky top-0 z-[60] flex h-9 w-full shrink-0 items-center justify-center gap-1 px-6 text-center font-sans text-xs font-medium"
      style={{ background: "#C9A84C", color: "#1A0F08" }}
    >
      <span>⚠ MAINTENANCE MODE IS ACTIVE — The public website is currently hidden from visitors.</span>
      <Link
        href="/admin/settings"
        className="ml-1 underline underline-offset-2 transition-opacity hover:opacity-80"
      >
        Turn off →
      </Link>
    </div>
  );
}
