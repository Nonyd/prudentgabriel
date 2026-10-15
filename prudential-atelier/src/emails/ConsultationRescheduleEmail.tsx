import { Heading, Section, Text } from "@react-email/components";
import EmailButton from "./components/EmailButton";
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
    <EmailLayout family="relationship" previewText={`New dates for your consultation ${bookingNumber}`}>
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: "#2d2d2d", margin: "0 0 12px" }}>
        New dates for your consultation
      </Heading>
      <Text style={{ fontSize: 16, color: "#333" }}>Dear {clientName},</Text>
      <Text style={{ fontSize: 15, color: "#333", marginTop: 12 }}>
        We have some alternative dates for your consultation with {consultantName} (reference #
        {bookingNumber}). We would love to find a time that suits you perfectly.
      </Text>
      {adminMessage ? (
        <Text style={{ fontSize: 14, color: "#444", marginTop: 16, lineHeight: 1.6 }}>{adminMessage}</Text>
      ) : null}
      <Section style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 15, fontWeight: 600 }}>Proposed dates</Text>
        {proposedDates.map((d) => (
          <Text key={d} style={{ fontSize: 14, color: "#333", margin: "6px 0" }}>
            • {d}
          </Text>
        ))}
      </Section>
      <Text style={{ marginTop: 20, fontSize: 14, color: "#555" }}>
        Simply reply to this email to confirm the date you prefer, and we will take care of the rest.
      </Text>
      <EmailButton href="mailto:hello@prudentgabriel.com">Contact us</EmailButton>
    </EmailLayout>
  );
}
