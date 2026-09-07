import { Section, Text } from "@react-email/components";
import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailButton from "./components/EmailButton";
import EmailLayout from "./components/EmailLayout";
import { CatalogHeading } from "./components/CatalogHeading";

const APP = getPublicAppUrl();

type OrderShippedEmailProps = {
  firstName: string;
  orderNumber: string;
  trackingNumber?: string;
  carrier?: string;
  estimatedDays?: string;
  catalogHeading?: string;
  catalogBody?: string;
  catalogCtaLabel?: string;
  catalogCtaHref?: string;
};

export default function OrderShippedEmail({
  firstName,
  orderNumber,
  trackingNumber,
  carrier,
  estimatedDays,
  catalogHeading,
  catalogBody,
  catalogCtaLabel,
  catalogCtaHref,
}: OrderShippedEmailProps) {
  return (
    <EmailLayout family="transactional" previewText={`Order #${orderNumber} has shipped`}>
      <CatalogHeading
        heading={catalogHeading}
        body={catalogBody}
        fallbackHeading="Your order is on its way!"
        fallbackBody={`Hi ${firstName}, your ${CUSTOMER_HOUSE_NAME} piece has shipped.`}
      />
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
      <EmailButton href={catalogCtaHref || `${APP}/account/orders`}>
        {catalogCtaLabel || "Track your order"}
      </EmailButton>
    </EmailLayout>
  );
}
