import { auth } from "@/auth";
import { ClockInClient } from "@/components/public/ClockInClient";
import { getActiveQRCode, getStaffClockStatus } from "@/lib/qr-attendance";

export default async function ClockInPage() {
  const session = await auth();
  const qr = await getActiveQRCode();
  const status = session?.user?.id ? await getStaffClockStatus(session.user.id) : null;

  return (
    <ClockInClient
      qrCode={qr?.code ?? null}
      expiresAt={qr?.expiresAt.toISOString() ?? null}
      initialStatus={
        status
          ? {
              isClockedIn: status.isClockedIn,
              log: status.log
                ? {
                    clockIn: status.log.clockIn?.toISOString() ?? null,
                    clockOut: status.log.clockOut?.toISOString() ?? null,
                  }
                : null,
              staff: {
                employmentType: status.staff.employmentType,
                user: {
                  name: status.staff.user.name,
                  email: status.staff.user.email ?? "",
                },
              },
            }
          : null
      }
    />
  );
}
