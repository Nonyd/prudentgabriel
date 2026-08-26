import { Heading, Text } from "@react-email/components";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailButton from "./components/EmailButton";
import EmailLayout from "./components/EmailLayout";

const APP = getPublicAppUrl();

export type RtwOrderDeliveredEmailProps = {
  firstName: string;
  orderNumber: string;
};

export default function RtwOrderDeliveredEmail({ firstName, orderNumber }: RtwOrderDeliveredEmailProps) {
  return (
    <EmailLayout family="transactional" previewText={`Order #${orderNumber} delivered`}>
      <Heading as="h1" style={{ fontSize: 28, fontWeight: 400, color: "#442913", margin: "0 0 12px" }}>
        Your order has been delivered, {firstName}.
      </Heading>
      <Text style={{ fontSize: 16, color: "#333", lineHeight: 1.6 }}>
        We hope you love your new piece. Order #{orderNumber} is now with you.
      </Text>
      <Text style={{ marginTop: 20, fontSize: 14, color: "#666" }}>
        In a day or so we will invite you to share a quick review. Your feedback means a great deal to the house.
      </Text>
      <EmailButton href={`${APP}/account/orders`}>View your order</EmailButton>
    </EmailLayout>
  );
}
