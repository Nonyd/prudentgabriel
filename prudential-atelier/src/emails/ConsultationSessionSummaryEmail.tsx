import { Heading, Img, Section, Text } from "@react-email/components";
import EmailButton from "./components/EmailButton";
import EmailLayout from "./components/EmailLayout";
import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import { getPublicAppUrl } from "@/lib/app-url";

export type ConsultationSessionSummaryEmailProps = {
  firstName: string;
  sessionNotes?: string;
  moodboardImages?: string[];
  moodboardUrl?: string;
  commissionUrl?: string;
  showCommissionCta?: boolean;
};

export default function ConsultationSessionSummaryEmail({
  firstName,
  sessionNotes,
  moodboardImages = [],
  moodboardUrl,
  commissionUrl,
  showCommissionCta = true,
}: ConsultationSessionSummaryEmailProps) {
  const appUrl = getPublicAppUrl();
  const moodboardLink = moodboardUrl ?? `${appUrl}/account/consultations`;
  const commissionLink = commissionUrl ?? `${appUrl}/atelier`;

  return (
    <EmailLayout family="relationship" previewText={`Thank you for sitting with us — ${CUSTOMER_HOUSE_NAME}`}>
      <Heading as="h1" style={{ fontSize: 26, fontWeight: 400, color: "#442913", margin: "0 0 12px" }}>
        Thank you for sitting with us, {firstName}.
      </Heading>
      <Text style={{ fontSize: 16, color: "#333", lineHeight: 1.6 }}>
        It was a pleasure getting to know your vision.
      </Text>

      {moodboardImages.length > 0 ? (
        <Section style={{ marginTop: 24 }}>
          <Text style={{ margin: "0 0 8px", fontSize: 13, letterSpacing: "0.12em", color: "#98755B", textTransform: "uppercase" }}>
            Your moodboard is ready
          </Text>
          <Text style={{ fontSize: 15, color: "#333", lineHeight: 1.6 }}>
            Our creative team has prepared your moodboard and inspiration references from today&apos;s session.
          </Text>
          <Section style={{ marginTop: 16, textAlign: "center" as const }}>
            {moodboardImages.slice(0, 3).map((src) => (
              <Img
                key={src}
                src={src}
                alt="Moodboard"
                width={160}
                height={120}
                style={{ display: "inline-block", margin: "4px", objectFit: "cover" as const, borderRadius: 4 }}
              />
            ))}
          </Section>
          <Section style={{ marginTop: 20, textAlign: "center" as const }}>
            <EmailButton href={moodboardLink}>View your moodboard</EmailButton>
          </Section>
        </Section>
      ) : null}

      {sessionNotes?.trim() ? (
        <Section style={{ marginTop: 24, padding: 16, backgroundColor: "rgba(201,168,76,0.08)", borderLeft: "3px solid #C9A84C" }}>
          <Text style={{ margin: "0 0 8px", fontSize: 13, letterSpacing: "0.12em", color: "#98755B", textTransform: "uppercase" }}>
            A note from your consultant
          </Text>
          <Text style={{ margin: 0, fontSize: 15, color: "#333", lineHeight: 1.6, whiteSpace: "pre-wrap" as const }}>
            {sessionNotes.trim()}
          </Text>
        </Section>
      ) : null}

      {showCommissionCta ? (
        <Section style={{ marginTop: 28 }}>
          <Text style={{ margin: "0 0 8px", fontSize: 13, letterSpacing: "0.12em", color: "#98755B", textTransform: "uppercase" }}>
            What happens next
          </Text>
          <Text style={{ fontSize: 15, color: "#333", lineHeight: 1.6 }}>
            Your invoice will be prepared and sent to you shortly for your review and approval.
          </Text>
          <Section style={{ marginTop: 20, textAlign: "center" as const }}>
            <EmailButton href={commissionLink}>Begin your commission</EmailButton>
          </Section>
        </Section>
      ) : null}
    </EmailLayout>
  );
}
