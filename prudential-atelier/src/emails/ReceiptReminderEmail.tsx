import { Button, Heading, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";

export type ReceiptReminderEmailProps = {
  firstName: string;
  orderRef: string;
  confirmUrl: string;
};

export default function ReceiptReminderEmail({
  firstName,
  orderRef,
  confirmUrl,
}: ReceiptReminderEmailProps) {
  return (
    <EmailLayout previewText={`Please confirm receipt of ${orderRef}`}>
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: "#442913", margin: "0 0 12px" }}>
        Have you received your garment?
      </Heading>
      <Text style={{ fontSize: 16, color: "#333", lineHeight: 1.6 }}>
        Hi {firstName}, your commission <strong>{orderRef}</strong> was marked delivered a week ago. If it has
        arrived safely, please confirm receipt so we can close your file.
      </Text>
      <div style={{ marginTop: 28, textAlign: "center" as const }}>
        <Button
          href={confirmUrl}
          style={{
            backgroundColor: "#442913",
            color: "#E2D1C2",
            padding: "14px 28px",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            borderRadius: 2,
          }}
        >
          Confirm receipt
        </Button>
      </div>
    </EmailLayout>
  );
}

export function subjectReceiptReminder(orderRef: string): string {
  return `Reminder: confirm receipt of ${orderRef} — Prudential Atelier`;
}
