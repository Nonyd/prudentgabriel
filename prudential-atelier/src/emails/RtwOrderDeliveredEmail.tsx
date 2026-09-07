import { Text } from "@react-email/components";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailButton from "./components/EmailButton";
import EmailLayout from "./components/EmailLayout";
import { CatalogHeading } from "./components/CatalogHeading";

const APP = getPublicAppUrl();

export type RtwOrderDeliveredEmailProps = {
  firstName: string;
  orderNumber: string;
  catalogHeading?: string;
  catalogBody?: string;
  catalogCtaLabel?: string;
  catalogCtaHref?: string;
};

export default function RtwOrderDeliveredEmail({
  firstName,
  orderNumber,
  catalogHeading,
  catalogBody,
  catalogCtaLabel,
  catalogCtaHref,
}: RtwOrderDeliveredEmailProps) {
  return (
    <EmailLayout family="transactional" previewText={`Order #${orderNumber} delivered`}>
      <CatalogHeading
        heading={catalogHeading}
        body={catalogBody}
        fallbackHeading={`Your order has been delivered, ${firstName}.`}
        fallbackBody={`We hope you love your new piece. Order #${orderNumber} is now with you.`}
      />
      <Text style={{ marginTop: 20, fontSize: 14, color: "#666" }}>
        In a day or so we will invite you to share a quick review. Your feedback means a great deal to the house.
      </Text>
      <EmailButton href={catalogCtaHref || `${APP}/account/orders`}>
        {catalogCtaLabel || "View your order"}
      </EmailButton>
    </EmailLayout>
  );
}
