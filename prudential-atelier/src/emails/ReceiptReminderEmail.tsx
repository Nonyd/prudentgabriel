import { Heading, Text } from "@react-email/components";
import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import EmailButton from "./components/EmailButton";
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
    <EmailLayout family="relationship" previewText={`Please confirm receipt of ${orderRef}`}>
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: "#442913", margin: "0 0 12px" }}>
        Have you received your garment?
      </Heading>
      <Text style={{ fontSize: 16, color: "#333", lineHeight: 1.6 }}>
        Hi {firstName}, your commission <strong>{orderRef}</strong> was marked delivered a week ago. If it has
        arrived safely, please confirm receipt so we can close your file.
      </Text>
      <EmailButton href={confirmUrl}>Confirm receipt</EmailButton>
    </EmailLayout>
  );
}

export function subjectReceiptReminder(orderRef: string): string {
  return `Reminder: confirm receipt of ${orderRef} — ${CUSTOMER_HOUSE_NAME}`;
}
