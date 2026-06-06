import { Button, Heading, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";

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
    <EmailLayout previewText={headline}>
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: "#442913", margin: "0 0 16px" }}>
        {headline}
      </Heading>
      <Text style={{ fontSize: 16, color: "#2d2d2d" }}>Hi {firstName},</Text>
      <Text style={{ fontSize: 15, color: "#444", lineHeight: 1.6 }}>{bodyParagraph}</Text>
      <Text style={{ fontSize: 14, color: "#666", marginTop: 16 }}>This takes less than 2 minutes.</Text>
      <Button
        href={ctaUrl}
        style={{
          marginTop: 24,
          backgroundColor: "#442913",
          color: "#F5F0E8",
          padding: "14px 28px",
          fontSize: 12,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {ctaLabel}
      </Button>
      <Text style={{ marginTop: 32, fontSize: 13, color: "#888" }}>— The Prudential Atelier Team</Text>
    </EmailLayout>
  );
}
