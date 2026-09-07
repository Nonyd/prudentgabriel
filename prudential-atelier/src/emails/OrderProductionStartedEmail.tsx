import { Heading, Text } from "@react-email/components";
import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailButton from "./components/EmailButton";
import EmailLayout from "./components/EmailLayout";

const APP = getPublicAppUrl();

type OrderProductionStartedEmailProps = {
  firstName: string;
  orderNumber: string;
};

export default function OrderProductionStartedEmail({
  firstName,
  orderNumber,
}: OrderProductionStartedEmailProps) {
  return (
    <EmailLayout family="transactional" previewText={`Production has started on order #${orderNumber}`}>
      <Heading as="h1" style={{ fontSize: 28, fontWeight: 400, color: "#2d2d2d", margin: "0 0 12px" }}>
        We have started making your piece
      </Heading>
      <Text style={{ fontSize: 16, color: "#2d2d2d" }}>Hi {firstName},</Text>
      <Text style={{ fontSize: 15, color: "#444", lineHeight: 1.6 }}>
        The atelier has begun production on order #{orderNumber}. Your {CUSTOMER_HOUSE_NAME} piece is now being
        made.
      </Text>
      <Text style={{ marginTop: 16, fontSize: 14, color: "#666", lineHeight: 1.6 }}>
        We will write again when it is on its way, or when it is ready to collect.
      </Text>
      <EmailButton href={`${APP}/account/orders`}>View your order</EmailButton>
    </EmailLayout>
  );
}
