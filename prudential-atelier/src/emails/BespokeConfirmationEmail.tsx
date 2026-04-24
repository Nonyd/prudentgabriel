import { Button, Heading, Section, Text } from "@react-email/components";
import { getPublicAppUrl } from "@/lib/app-url";
import EmailLayout from "./components/EmailLayout";

const APP = getPublicAppUrl();

type BespokeConfirmationEmailProps = {
  name: string;
  requestNumber: string;
  occasion: string;
  timeline: string;
};

export default function BespokeConfirmationEmail({
  name,
  requestNumber,
  occasion,
  timeline,
}: BespokeConfirmationEmailProps) {
  return (
    <EmailLayout previewText={`Bespoke request ${requestNumber}`}>
      <Heading as="h1" style={{ fontSize: 28, fontWeight: 400, color: "#2d2d2d", margin: "0 0 12px" }}>
        Your bespoke request
      </Heading>
      <Text style={{ fontSize: 16, color: "#2d2d2d" }}>Thank you, {name}. We&apos;ve received your request.</Text>
      <Section
        style={{
          marginTop: 20,
          padding: 16,
          border: "2px solid #C9A84C",
          textAlign: "center" as const,
        }}
      >
        <Text style={{ margin: 0, fontSize: 18 }}>#{requestNumber}</Text>
      </Section>
      <Text style={{ marginTop: 24, fontSize: 15, fontWeight: 600 }}>What happens next?</Text>
      <Text style={{ fontSize: 14, color: "#333", lineHeight: 1.7 }}>
        • Our team will review your request within 24–48 hours.
        <br />• We will contact you to discuss your vision and confirm details.
        <br />• Once confirmed, we&apos;ll begin crafting your piece.
      </Text>
      <Text style={{ marginTop: 16, fontSize: 14 }}>
        Occasion: {occasion} · Timeline: {timeline}
      </Text>
      <Text style={{ marginTop: 16, fontSize: 14 }}>In the meantime, browse our ready-to-wear collection.</Text>
      <Section style={{ marginTop: 24, textAlign: "center" as const }}>
        <Button
          href={`${APP}/shop`}
          style={{
            backgroundColor: "#6B1C2A",
            color: "#C9A84C",
            padding: "12px 32px",
            textDecoration: "none",
            fontSize: 15,
          }}
        >
          Browse collection
        </Button>
      </Section>
      <Text style={{ marginTop: 24, fontSize: 13, color: "#555" }}>
        Reach us at hello@prudentgabriel.com or @prudent_gabriel on Instagram.
      </Text>
    </EmailLayout>
  );
}
