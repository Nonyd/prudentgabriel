import { Heading, Text } from "@react-email/components";
import EmailButton from "./components/EmailButton";
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
    <EmailLayout family="relationship" previewText={`Your consultation ${bookingNumber} has been cancelled`}>
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: "#2d2d2d", margin: "0 0 12px" }}>
        Your consultation has been cancelled
      </Heading>
      <Text style={{ fontSize: 16, color: "#333" }}>Dear {clientName},</Text>
      <Text style={{ fontSize: 15, color: "#333", marginTop: 12 }}>
        Booking #{bookingNumber} with {consultantName} has been cancelled. We are sorry we will not be seeing you
        as planned.
      </Text>
      {reason ? (
        <Text style={{ fontSize: 14, color: "#555", marginTop: 12 }}>
          <strong>Reason:</strong> {reason}
        </Text>
      ) : null}
      <Text style={{ fontSize: 14, color: "#555", marginTop: 16 }}>
        If you have any questions, please write to us at hello@prudentgabriel.com. Whenever you are ready, we
        would be glad to welcome you for another session.
      </Text>
      <EmailButton href={`${APP}/consultation`}>Book another session</EmailButton>
    </EmailLayout>
  );
}
