import { Button, Heading, Section, Text } from "@react-email/components";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailLayout from "./components/EmailLayout";

const APP = getPublicAppUrl();

export type ConsultationConfirmedEmailProps = {
  clientName: string;
  bookingNumber: string;
  consultantName: string;
  sessionTypeLabel: string;
  deliveryModeLabel: string;
  confirmedDate: string;
  confirmedTime: string;
  durationMinutes: number;
  isVirtual: boolean;
  meetingLink?: string;
  meetingPlatform?: string;
  atelierAddress?: string;
};

export default function ConsultationConfirmedEmail({
  clientName,
  bookingNumber,
  consultantName,
  sessionTypeLabel,
  deliveryModeLabel,
  confirmedDate,
  confirmedTime,
  durationMinutes,
  isVirtual,
  meetingLink,
  meetingPlatform,
  atelierAddress,
}: ConsultationConfirmedEmailProps) {
  const dayLine = (() => {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Africa/Lagos",
      }).format(new Date(confirmedDate));
    } catch {
      return confirmedDate;
    }
  })();

  return (
    <EmailLayout previewText={`Consultation confirmed ${bookingNumber}`}>
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: "#2d2d2d", margin: "0 0 12px" }}>
        Your consultation is confirmed
      </Heading>
      <Text style={{ fontSize: 16, color: "#333" }}>Dear {clientName},</Text>
      <Section
        style={{
          marginTop: 20,
          padding: 20,
          border: "2px solid #6B1C2A",
          backgroundColor: "rgba(201,168,76,0.08)",
        }}
      >
        <Text style={{ margin: 0, fontSize: 15 }}>📅 {dayLine}</Text>
        <Text style={{ margin: "8px 0 0", fontSize: 15 }}>
          🕐 {confirmedTime} WAT · {durationMinutes} minutes
        </Text>
        <Text style={{ margin: "8px 0 0", fontSize: 15 }}>👤 {consultantName}</Text>
        <Text style={{ margin: "8px 0 0", fontSize: 15 }}>📋 {sessionTypeLabel}</Text>
        <Text style={{ margin: "8px 0 0", fontSize: 14, color: "#444" }}>{deliveryModeLabel}</Text>
      </Section>
      {isVirtual ? (
        <Section style={{ marginTop: 20, padding: 16, backgroundColor: "rgba(201,168,76,0.12)" }}>
          <Text style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>📹 {meetingPlatform ?? "Video call"}</Text>
          {meetingLink ? (
            <Section style={{ marginTop: 12, textAlign: "center" as const }}>
              <Button
                href={meetingLink}
                style={{
                  backgroundColor: "#6B1C2A",
                  color: "#C9A84C",
                  padding: "12px 28px",
                  textDecoration: "none",
                  fontSize: 15,
                }}
              >
                Join meeting
              </Button>
            </Section>
          ) : (
            <Text style={{ marginTop: 8, fontSize: 14 }}>Your meeting link will be sent separately.</Text>
          )}
          <Text style={{ marginTop: 12, fontSize: 13, color: "#555" }}>
            Please join 2–3 minutes before your scheduled time.
          </Text>
        </Section>
      ) : (
        <Text style={{ marginTop: 20, fontSize: 14, lineHeight: 1.7 }}>
          📍 {atelierAddress ?? "Our team will be in touch to confirm location details."}
          <br />
          Please arrive 5 minutes early. Wear or bring any reference items you&apos;d like to discuss.
        </Text>
      )}
      <Text style={{ marginTop: 20, fontSize: 14, color: "#333", lineHeight: 1.7 }}>
        • Prepare reference images or inspiration boards.
        <br />
        • Note specific concerns or requirements.
        {isVirtual ? (
          <>
            <br />• Ensure a stable internet connection.
          </>
        ) : null}
      </Text>
      <Text style={{ marginTop: 16, fontSize: 13, color: "#555" }}>
        Need to reschedule? Contact hello@prudentgabriel.com at least 48 hours before your session.
      </Text>
      <Section style={{ marginTop: 24, textAlign: "center" as const }}>
        <Button
          href={`${APP}/consultation/${encodeURIComponent(bookingNumber)}`}
          style={{
            backgroundColor: "#6B1C2A",
            color: "#C9A84C",
            padding: "12px 28px",
            textDecoration: "none",
            fontSize: 15,
          }}
        >
          View booking details
        </Button>
      </Section>
    </EmailLayout>
  );
}
