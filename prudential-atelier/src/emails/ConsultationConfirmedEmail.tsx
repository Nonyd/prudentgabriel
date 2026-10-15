import { Heading, Section, Text } from "@react-email/components";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailButton from "./components/EmailButton";
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
    <EmailLayout family="relationship" previewText={`Your consultation is confirmed: ${bookingNumber}`}>
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: "#2d2d2d", margin: "0 0 12px" }}>
        Your consultation is confirmed
      </Heading>
      <Text style={{ fontSize: 16, color: "#333" }}>Dear {clientName},</Text>
      <Text style={{ fontSize: 15, color: "#333", marginTop: 12 }}>
        We are truly delighted to confirm your consultation, and we cannot wait to begin this journey with you.
      </Text>
      <Section
        style={{
          marginTop: 20,
          padding: 20,
          border: "2px solid #442913",
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
              <EmailButton href={meetingLink}>Join meeting</EmailButton>
            </Section>
          ) : (
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
              This message does not include a meeting link yet. We will email it to you as soon as Prudent
              Gabriel sets it, and again about an hour before you join.
            </Text>
          )}
          <Text style={{ marginTop: 12, fontSize: 13, color: "#555" }}>
            Please join 2–3 minutes before your scheduled time so we can begin together.
          </Text>
        </Section>
      ) : (
        <Text style={{ marginTop: 20, fontSize: 14, lineHeight: 1.7 }}>
          📍 {atelierAddress ?? "Our team will be in touch to confirm location details."}
          <br />
          Please arrive 5 minutes early. Do wear or bring any reference pieces you would like to discuss.
        </Text>
      )}
      <Text style={{ marginTop: 20, fontSize: 14, color: "#333", lineHeight: 1.7 }}>
        • Gather any reference images or inspiration boards you love.
        <br />
        • Note any specific concerns or requirements.
        {isVirtual ? (
          <>
            <br />• Ensure a stable internet connection.
          </>
        ) : null}
      </Text>
      <Text style={{ marginTop: 16, fontSize: 13, color: "#555" }}>
        Need to reschedule? Please contact hello@prudentgabriel.com at least 48 hours before your session.
      </Text>
      <EmailButton href={`${APP}/consultation/${encodeURIComponent(bookingNumber)}`}>View booking details</EmailButton>
    </EmailLayout>
  );
}
