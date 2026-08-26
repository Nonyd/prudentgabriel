import { Heading, Section, Text } from "@react-email/components";
import EmailButton from "./components/EmailButton";
import EmailLayout from "./components/EmailLayout";

export type ConsultationMeetingLinkEmailProps = {
  clientName: string;
  platformLabel: string;
  confirmedDate: string;
  confirmedTime: string;
  meetingLink: string;
  isWhatsApp: boolean;
};

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Africa/Lagos",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function ConsultationMeetingLinkEmail({
  clientName,
  platformLabel,
  confirmedDate,
  confirmedTime,
  meetingLink,
  isWhatsApp,
}: ConsultationMeetingLinkEmailProps) {
  return (
    <EmailLayout family="relationship" previewText="Your consultation link — Prudential Atelier">
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: "#2d2d2d", margin: "0 0 12px" }}>
        Your consultation link
      </Heading>
      <Text style={{ fontSize: 16, color: "#333" }}>Hi {clientName},</Text>
      <Text style={{ fontSize: 16, color: "#333", lineHeight: 1.6 }}>
        Your {platformLabel} consultation is coming up soon.
      </Text>
      <Section style={{ marginTop: 20, padding: 16, backgroundColor: "rgba(201,168,76,0.08)" }}>
        <Text style={{ margin: 0, fontSize: 15 }}>DATE: {fmtDate(confirmedDate)}</Text>
        <Text style={{ margin: "8px 0 0", fontSize: 15 }}>TIME: {confirmedTime} WAT</Text>
      </Section>
      <Section style={{ marginTop: 24, textAlign: "center" as const }}>
        <EmailButton href={meetingLink}>Join consultation</EmailButton>
      </Section>
      <Text style={{ marginTop: 20, fontSize: 14, color: "#555", lineHeight: 1.6 }}>
        {isWhatsApp
          ? "Click the button above to start the WhatsApp video call at your scheduled time."
          : "Click the button above to join your consultation at the scheduled time."}
      </Text>
      <Text style={{ marginTop: 24, fontSize: 14, color: "#666" }}>
        See you soon,
        <br />
        — Prudential Atelier
      </Text>
    </EmailLayout>
  );
}
