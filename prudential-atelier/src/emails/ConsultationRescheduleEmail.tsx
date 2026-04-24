import { Button, Heading, Section, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";

export type ConsultationRescheduleEmailProps = {
  clientName: string;
  bookingNumber: string;
  consultantName: string;
  proposedDates: string[];
  adminMessage?: string;
};

export default function ConsultationRescheduleEmail({
  clientName,
  bookingNumber,
  consultantName,
  proposedDates,
  adminMessage,
}: ConsultationRescheduleEmailProps) {
  return (
    <EmailLayout previewText={`Alternative dates ${bookingNumber}`}>
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: "#2d2d2d", margin: "0 0 12px" }}>
        New dates have been proposed
      </Heading>
      <Text style={{ fontSize: 16, color: "#333" }}>Dear {clientName},</Text>
      <Text style={{ fontSize: 15, color: "#333", marginTop: 12 }}>
        We have alternative scheduling options for your consultation with {consultantName} (reference #
        {bookingNumber}).
      </Text>
      {adminMessage ? (
        <Text style={{ fontSize: 14, color: "#444", marginTop: 16, lineHeight: 1.6 }}>{adminMessage}</Text>
      ) : null}
      <Section style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 15, fontWeight: 600 }}>Proposed alternatives</Text>
        {proposedDates.map((d) => (
          <Text key={d} style={{ fontSize: 14, color: "#333", margin: "6px 0" }}>
            • {d}
          </Text>
        ))}
      </Section>
      <Text style={{ marginTop: 20, fontSize: 14, color: "#555" }}>
        Please reply to this email to confirm your preferred date.
      </Text>
      <Section style={{ marginTop: 24, textAlign: "center" as const }}>
        <Button
          href="mailto:hello@prudentgabriel.com"
          style={{
            backgroundColor: "#6B1C2A",
            color: "#C9A84C",
            padding: "12px 28px",
            textDecoration: "none",
            fontSize: 15,
          }}
        >
          Contact us
        </Button>
      </Section>
    </EmailLayout>
  );
}
