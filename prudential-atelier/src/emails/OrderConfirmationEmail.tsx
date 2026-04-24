import { Button, Column, Heading, Hr, Row, Section, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";

import { getPublicAppUrl } from "@/lib/app-url";

const APP = getPublicAppUrl();

export type OrderItemLine = {
  name: string;
  size: string;
  color?: string;
  qty: number;
  priceNGN: number;
};

type OrderConfirmationEmailProps = {
  firstName: string;
  orderNumber: string;
  items: OrderItemLine[];
  subtotalNGN: number;
  shippingNGN: number;
  discountNGN: number;
  pointsDiscNGN: number;
  totalNGN: number;
  addressSnapshot?: Record<string, string>;
  estimatedDays?: string;
};

export default function OrderConfirmationEmail({
  firstName,
  orderNumber,
  items,
  subtotalNGN,
  shippingNGN,
  discountNGN,
  pointsDiscNGN,
  totalNGN,
  addressSnapshot,
  estimatedDays,
}: OrderConfirmationEmailProps) {
  const addr = addressSnapshot ?? {};
  const line = (i: OrderItemLine) => {
    const bits = [i.name, `Size ${i.size}`, i.color ? i.color : null, `×${i.qty}`].filter(Boolean).join(" · ");
    return `${bits} — ₦${Math.round(i.priceNGN * i.qty).toLocaleString("en-NG")}`;
  };

  return (
    <EmailLayout previewText={`Order #${orderNumber} confirmed`}>
      <Heading as="h1" style={{ fontSize: 32, fontWeight: 400, color: "#2d2d2d", margin: "0 0 12px" }}>
        Thank you, {firstName}.
      </Heading>
      <Text style={{ fontSize: 16, color: "#2d2d2d" }}>Your order is confirmed.</Text>
      <Section
        style={{
          marginTop: 20,
          padding: 16,
          border: "2px solid #C9A84C",
          textAlign: "center" as const,
        }}
      >
        <Text style={{ margin: 0, fontSize: 18, letterSpacing: 2 }}>#{orderNumber}</Text>
      </Section>
      <Section style={{ marginTop: 24 }}>
        {items.map((i, idx) => (
          <Text key={idx} style={{ margin: "8px 0", fontSize: 14, color: "#333" }}>
            {line(i)}
          </Text>
        ))}
      </Section>
      <Hr style={{ borderColor: "#e8e4dc" }} />
      <Row>
        <Column>
          <Text style={{ margin: "4px 0", fontSize: 14 }}>Subtotal</Text>
          <Text style={{ margin: "4px 0", fontSize: 14 }}>Shipping</Text>
          {discountNGN > 0 ? (
            <Text style={{ margin: "4px 0", fontSize: 14, color: "#166534" }}>Discount</Text>
          ) : null}
          {pointsDiscNGN > 0 ? (
            <Text style={{ margin: "4px 0", fontSize: 14, color: "#6B1C2A" }}>Points discount</Text>
          ) : null}
          <Text style={{ margin: "12px 0 4px", fontSize: 16, fontWeight: 600 }}>Total</Text>
        </Column>
        <Column align="right">
          <Text style={{ margin: "4px 0", fontSize: 14 }}>₦{Math.round(subtotalNGN).toLocaleString("en-NG")}</Text>
          <Text style={{ margin: "4px 0", fontSize: 14 }}>
            {shippingNGN <= 0 ? "Free" : `₦${Math.round(shippingNGN).toLocaleString("en-NG")}`}
          </Text>
          {discountNGN > 0 ? (
            <Text style={{ margin: "4px 0", fontSize: 14, color: "#166534" }}>
              −₦{Math.round(discountNGN).toLocaleString("en-NG")}
            </Text>
          ) : null}
          {pointsDiscNGN > 0 ? (
            <Text style={{ margin: "4px 0", fontSize: 14, color: "#6B1C2A" }}>
              −₦{Math.round(pointsDiscNGN).toLocaleString("en-NG")}
            </Text>
          ) : null}
          <Text style={{ margin: "12px 0 4px", fontSize: 16, fontWeight: 600, color: "#6B1C2A" }}>
            ₦{Math.round(totalNGN).toLocaleString("en-NG")}
          </Text>
        </Column>
      </Row>
      {Object.keys(addr).length > 0 ? (
        <Section style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: 600 }}>Delivery address</Text>
          <Text style={{ fontSize: 14, color: "#444", lineHeight: 1.5 }}>
            {[addr.firstName, addr.lastName].filter(Boolean).join(" ")}
            <br />
            {[addr.line1, addr.line2].filter(Boolean).join(", ")}
            <br />
            {[addr.city, addr.state, addr.country, addr.postalCode].filter(Boolean).join(", ")}
          </Text>
        </Section>
      ) : null}
      {estimatedDays ? (
        <Text style={{ marginTop: 16, fontSize: 14 }}>Estimated delivery: {estimatedDays}</Text>
      ) : null}
      <Section style={{ marginTop: 32, textAlign: "center" as const }}>
        <Button
          href={`${APP}/account/orders`}
          style={{
            backgroundColor: "#6B1C2A",
            color: "#C9A84C",
            padding: "12px 32px",
            textDecoration: "none",
            fontSize: 15,
          }}
        >
          Track your order
        </Button>
      </Section>
      <Text style={{ marginTop: 24, fontSize: 13, color: "#555" }}>
        Questions? Reply to this email or contact hello@prudentgabriel.com
      </Text>
    </EmailLayout>
  );
}
