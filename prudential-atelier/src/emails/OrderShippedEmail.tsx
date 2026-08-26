import { Heading, Section, Text } from "@react-email/components";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailButton from "./components/EmailButton";
import EmailLayout from "./components/EmailLayout";

const APP = getPublicAppUrl();

type OrderShippedEmailProps = {
  firstName: string;
  orderNumber: string;
  trackingNumber?: string;
  carrier?: string;
  estimatedDays?: string;
};

export default function OrderShippedEmail({
  firstName,
  orderNumber,
  trackingNumber,
  carrier,
  estimatedDays,
}: OrderShippedEmailProps) {
  return (
    <EmailLayout family="transactional" previewText={`Order #${orderNumber} has shipped`}>
      <Heading as="h1" style={{ fontSize: 28, fontWeight: 400, color: "#2d2d2d", margin: "0 0 12px" }}>
        Your order is on its way!
      </Heading>
      <Text style={{ fontSize: 16, color: "#2d2d2d" }}>Hi {firstName}, your Prudential Atelier piece has shipped.</Text>
      <Text style={{ fontSize: 15, color: "#444" }}>Order #{orderNumber}</Text>
      {trackingNumber ? (
        <Section
          style={{
            marginTop: 20,
            padding: 16,
            border: "1px solid #C9A84C",
            backgroundColor: "rgba(201,168,76,0.08)",
          }}
        >
          <Text style={{ margin: 0, fontSize: 14 }}>
            <strong>Tracking</strong>: {trackingNumber}
            {carrier ? (
              <>
                {" "}
                · {carrier}
              </>
            ) : null}
          </Text>
        </Section>
      ) : null}
      {estimatedDays ? (
        <Text style={{ marginTop: 16, fontSize: 14 }}>Estimated delivery: {estimatedDays}</Text>
      ) : null}
      <EmailButton href={`${APP}/account/orders`}>Track your order</EmailButton>
    </EmailLayout>
  );
}
