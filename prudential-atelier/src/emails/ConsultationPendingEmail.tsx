import { Button, Heading, Section, Text } from "@react-email/components";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailLayout from "./components/EmailLayout";

const APP = getPublicAppUrl();

export type ConsultationPendingEmailProps = {
  clientName: string;
  bookingNumber: string;
  consultantName: string;
  sessionTypeLabel: string;
  deliveryModeLabel: string;
  feeNGN: number;
  preferredDate1?: string;
  preferredDate2?: string;
  preferredDate3?: string;
};

function fmt(d?: string): string {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "long",
      timeZone: "Africa/Lagos",
    }).format(new Date(d));
  } catch {
    return d;
  }
}

export default function ConsultationPendingEmail({
  clientName,
  bookingNumber,
  consultantName,
  sessionTypeLabel,
  deliveryModeLabel,
  feeNGN,
  preferredDate1,
  preferredDate2,
  preferredDate3,
}: ConsultationPendingEmailProps) {
  return (
    <EmailLayout previewText={`Consultation request ${bookingNumber}`}>
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: "#2d2d2d", margin: "0 0 12px" }}>
        Thank you, {clientName}
      </Heading>
      <Text style={{ fontSize: 16, color: "#333", lineHeight: 1.6 }}>
        Your consultation request has been received and your payment confirmed.
      </Text>
      <Section
        style={{
          marginTop: 20,
          padding: 16,
          border: "2px solid #C9A84C",
          textAlign: "center" as const,
        }}
      >
        <Text style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>#{bookingNumber}</Text>
        <Text style={{ margin: "8px 0 0", fontSize: 14, color: "#444" }}>
          {consultantName} · {sessionTypeLabel} · {deliveryModeLabel}
        </Text>
        <Text style={{ margin: "8px 0 0", fontSize: 13, color: "#555" }}>Fee paid: ₦{feeNGN.toLocaleString("en-NG")}</Text>
      </Section>
      <Text style={{ marginTop: 24, fontSize: 15, fontWeight: 600 }}>Your preferred dates</Text>
      <Text style={{ fontSize: 14, color: "#333", lineHeight: 1.8 }}>
        {preferredDate1 ? `• ${fmt(preferredDate1)}` : ""}
        {preferredDate2 ? <><br />• {fmt(preferredDate2)}</> : null}
        {preferredDate3 ? <><br />• {fmt(preferredDate3)}</> : null}
      </Text>
      <Text style={{ marginTop: 20, fontSize: 14, color: "#333", lineHeight: 1.7 }}>
        1. Our team will review your preferred dates.
        <br />
        2. {consultantName} will personally confirm your session.
        <br />
        3. You will receive your confirmation within 24–48 hours.
      </Text>
      <Text style={{ marginTop: 16, fontSize: 14, color: "#555" }}>
        In the meantime, reply to this email or reach us at hello@prudentgabriel.com
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
          View your booking
        </Button>
      </Section>
    </EmailLayout>
  );
}
