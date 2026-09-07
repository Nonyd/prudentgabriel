import { Text } from "@react-email/components";
import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import EmailButton from "./components/EmailButton";
import EmailLayout from "./components/EmailLayout";
import { CatalogHeading } from "./components/CatalogHeading";

export type BespokeDeliveredEmailProps = {
  firstName: string;
  orderRef: string;
  confirmUrl: string;
  accountUrl: string;
  catalogHeading?: string;
  catalogBody?: string;
  catalogCtaLabel?: string;
};

export default function BespokeDeliveredEmail({
  firstName,
  orderRef,
  confirmUrl,
  accountUrl,
  catalogHeading,
  catalogBody,
  catalogCtaLabel,
}: BespokeDeliveredEmailProps) {
  return (
    <EmailLayout family="relationship" previewText={`Your commission ${orderRef} has been delivered`}>
      <CatalogHeading
        heading={catalogHeading}
        body={catalogBody}
        fallbackHeading={`Your commission is with you, ${firstName}.`}
        fallbackBody={`Order ${orderRef} has been marked delivered. We hope every detail feels exactly as you imagined.`}
      />
      <div style={{ marginTop: 28, textAlign: "center" as const }}>
        <EmailButton href={confirmUrl}>{catalogCtaLabel || "Confirm receipt"}</EmailButton>
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
