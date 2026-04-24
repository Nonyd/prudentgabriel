import { Button, Heading, Text } from "@react-email/components";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailLayout from "./components/EmailLayout";

const APP = getPublicAppUrl();

export type ConsultationCancelledEmailProps = {
  clientName: string;
  bookingNumber: string;
  consultantName: string;
  reason?: string;
};

export default function ConsultationCancelledEmail({
  clientName,
  bookingNumber,
  consultantName,
  reason,
}: ConsultationCancelledEmailProps) {
  return (
    <EmailLayout previewText={`Consultation cancelled ${bookingNumber}`}>
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: "#2d2d2d", margin: "0 0 12px" }}>
        Your consultation has been cancelled
      </Heading>
      <Text style={{ fontSize: 16, color: "#333" }}>Dear {clientName},</Text>
      <Text style={{ fontSize: 15, color: "#333", marginTop: 12 }}>
        Booking #{bookingNumber} with {consultantName} has been cancelled.
      </Text>
      {reason ? (
        <Text style={{ fontSize: 14, color: "#555", marginTop: 12 }}>
          <strong>Reason:</strong> {reason}
        </Text>
      ) : null}
      <Text style={{ fontSize: 14, color: "#555", marginTop: 16 }}>
        For questions, contact hello@prudentgabriel.com
      </Text>
      <Text style={{ marginTop: 24, textAlign: "center" as const }}>
        <Button
          href={`${APP}/consultation`}
          style={{
            backgroundColor: "#6B1C2A",
            color: "#C9A84C",
            padding: "12px 28px",
            textDecoration: "none",
            fontSize: 15,
          }}
        >
          Book another session
        </Button>
      </Text>
    </EmailLayout>
  );
}
