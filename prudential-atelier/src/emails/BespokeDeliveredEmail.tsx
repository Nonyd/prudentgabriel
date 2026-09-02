import { Heading, Text } from "@react-email/components";
import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import EmailButton from "./components/EmailButton";
import EmailLayout from "./components/EmailLayout";

export type BespokeDeliveredEmailProps = {
  firstName: string;
  orderRef: string;
  confirmUrl: string;
  accountUrl: string;
};

export default function BespokeDeliveredEmail({
  firstName,
  orderRef,
  confirmUrl,
  accountUrl,
}: BespokeDeliveredEmailProps) {
  return (
    <EmailLayout family="relationship" previewText={`Your commission ${orderRef} has been delivered`}>
      <Heading as="h1" style={{ fontSize: 28, fontWeight: 400, color: "#442913", margin: "0 0 12px" }}>
        Your commission is with you, {firstName}.
      </Heading>
      <Text style={{ fontSize: 16, color: "#333", lineHeight: 1.6 }}>
        Order <strong>{orderRef}</strong> has been marked delivered. We hope every detail feels exactly as you
        imagined.
      </Text>
      <Text style={{ fontSize: 15, color: "#444", lineHeight: 1.6, marginTop: 16 }}>
        Please confirm you have received your garment — it only takes a moment and helps us close your commission
        properly.
      </Text>
      <div style={{ marginTop: 28, textAlign: "center" as const }}>
        <EmailButton href={confirmUrl}>Confirm receipt</EmailButton>
      </div>
      <Text style={{ marginTop: 20, fontSize: 13, color: "#666", textAlign: "center" as const }}>
        Or view your order in your account:{" "}
        <a href={accountUrl} style={{ color: "#5C3422" }}>
          {accountUrl}
        </a>
      </Text>
    </EmailLayout>
  );
}

export function subjectBespokeDelivered(orderRef: string): string {
  return `Your commission ${orderRef} has been delivered — ${CUSTOMER_HOUSE_NAME}`;
}
