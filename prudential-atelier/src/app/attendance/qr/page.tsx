import { format } from "date-fns";
import { AttendanceQrDisplay } from "@/components/attendance/AttendanceQrDisplay";
import { getActiveQRCode } from "@/lib/qr-attendance";

export const dynamic = "force-dynamic";

export default async function AttendanceQrPage() {
  const active = await getActiveQRCode();
  const payload = active
    ? JSON.stringify({
        code: active.code,
        date: format(new Date(), "yyyy-MM-dd"),
        location: "Atelier Floor",
      })
    : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-choc px-6 py-12 text-cream">
      <AttendanceQrDisplay payload={payload} />
      <p className="mt-8 font-serif text-base text-cream/80">Scan to clock in/out</p>
      <p className="mt-2 font-sans text-sm text-lightbr">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
    </div>
  );
}
