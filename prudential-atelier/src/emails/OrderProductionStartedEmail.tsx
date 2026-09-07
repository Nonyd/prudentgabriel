import { Text } from "@react-email/components";
import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailButton from "./components/EmailButton";
import EmailLayout from "./components/EmailLayout";
import { CatalogHeading } from "./components/CatalogHeading";

const APP = getPublicAppUrl();

type OrderProductionStartedEmailProps = {
  firstName: string;
  orderNumber: string;
  catalogHeading?: string;
  catalogBody?: string;
  catalogCtaLabel?: string;
  catalogCtaHref?: string;
};

export default function OrderProductionStartedEmail({
  firstName,
  orderNumber,
  catalogHeading,
  catalogBody,
  catalogCtaLabel,
  catalogCtaHref,
}: OrderProductionStartedEmailProps) {
  return (
    <EmailLayout family="transactional" previewText={`Production has started on order #${orderNumber}`}>
      <CatalogHeading
        heading={catalogHeading}
        body={catalogBody}
        fallbackHeading="We have started making your piece"
        fallbackBody={`Hi ${firstName},\n\nThe atelier has begun production on order #${orderNumber}. Your ${CUSTOMER_HOUSE_NAME} piece is now being made.`}
      />
      <Text style={{ marginTop: 16, fontSize: 14, color: "#666", lineHeight: 1.6 }}>
        We will write again when it is on its way, or when it is ready to collect.
      </Text>
      <EmailButton href={catalogCtaHref || `${APP}/account/orders`}>
        {catalogCtaLabel || "View your order"}
      </EmailButton>
    </EmailLayout>
  );
}
