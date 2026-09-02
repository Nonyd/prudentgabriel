import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import { Heading, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";
import EmailButton from "./components/EmailButton";

type ReviewRequestEmailProps = {
  firstName: string;
  headline: string;
  bodyParagraph: string;
  ctaLabel: string;
  ctaUrl: string;
};

export default function ReviewRequestEmail({
  firstName,
  headline,
  bodyParagraph,
  ctaLabel,
  ctaUrl,
}: ReviewRequestEmailProps) {
  return (
    <EmailLayout family="relationship" previewText={headline}>
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: "#442913", margin: "0 0 16px" }}>
        {headline}
      </Heading>
      <Text style={{ fontSize: 16, color: "#2d2d2d" }}>Hi {firstName},</Text>
      <Text style={{ fontSize: 15, color: "#444", lineHeight: 1.6 }}>{bodyParagraph}</Text>
      <Text style={{ fontSize: 14, color: "#666", marginTop: 16 }}>This takes less than 2 minutes.</Text>
      <EmailButton href={ctaUrl}>{ctaLabel}</EmailButton>
      <Text style={{ marginTop: 32, fontSize: 13, color: "#888" }}>— {CUSTOMER_HOUSE_NAME}</Text>
    </EmailLayout>
  );
}
