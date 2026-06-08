import { Button, Heading, Text } from "@react-email/components";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailLayout from "./components/EmailLayout";

const APP = getPublicAppUrl();

export type RtwOrderDeliveredEmailProps = {
  firstName: string;
  orderNumber: string;
};

export default function RtwOrderDeliveredEmail({ firstName, orderNumber }: RtwOrderDeliveredEmailProps) {
  return (
    <EmailLayout previewText={`Order #${orderNumber} delivered`}>
      <Heading as="h1" style={{ fontSize: 28, fontWeight: 400, color: "#442913", margin: "0 0 12px" }}>
        Your order has been delivered, {firstName}.
      </Heading>
      <Text style={{ fontSize: 16, color: "#333", lineHeight: 1.6 }}>
        We hope you love your new piece. Order #{orderNumber} is now with you.
      </Text>
      <Text style={{ marginTop: 20, fontSize: 14, color: "#666" }}>
        In a day or so we&apos;ll invite you to share a quick review — your feedback means the world to us.
      </Text>
      <div style={{ marginTop: 28, textAlign: "center" as const }}>
        <Button
          href={`${APP}/account/orders`}
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
          View your order
        </Button>
      </div>
    </EmailLayout>
  );
}
