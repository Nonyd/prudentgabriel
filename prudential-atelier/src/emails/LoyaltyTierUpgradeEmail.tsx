import { Heading, Section, Text } from "@react-email/components";
import EmailButton from "./components/EmailButton";
import type { LoyaltyTier } from "@prisma/client";
import { getPublicAppUrl } from "@/lib/app-url";
import { TIER_LABELS } from "@/lib/loyalty";
import EmailLayout from "./components/EmailLayout";

const APP = getPublicAppUrl();

export type LoyaltyTierUpgradeEmailProps = {
  firstName: string;
  newTier: LoyaltyTier;
  perks: string[];
};

export default function LoyaltyTierUpgradeEmail({ firstName, newTier, perks }: LoyaltyTierUpgradeEmailProps) {
  const tierLabel = TIER_LABELS[newTier];

  return (
    <EmailLayout family="relationship" previewText={`You've reached ${tierLabel} status — Prudential Atelier`}>
      <Text style={{ fontSize: 16, color: "#333" }}>Congratulations, {firstName}!</Text>
      <Heading
        as="h1"
        style={{
          fontFamily: "Cormorant Garamond, Georgia, serif",
          fontSize: 42,
          fontWeight: 400,
          color: "#442913",
          margin: "8px 0 16px",
          letterSpacing: "0.04em",
        }}
      >
        {tierLabel}
      </Heading>
      <Section style={{ margin: "16px auto 24px", textAlign: "center" as const }}>
        <div
          style={{
            display: "inline-block",
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #C9A84C 0%, #98755B 100%)",
            lineHeight: "72px",
            fontSize: 32,
            color: "#1A0F08",
          }}
        >
          ✦
        </div>
      </Section>
      <Text
        style={{
          margin: "0 0 12px",
          fontSize: 13,
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          color: "#98755B",
        }}
      >
        Your new perks
      </Text>
      {perks.map((perk) => (
        <Text key={perk} style={{ margin: "6px 0", fontSize: 15, color: "#333", lineHeight: 1.5 }}>
          ✓ {perk}
        </Text>
      ))}
      <EmailButton href={`${APP}/account/loyalty`}>View your rewards</EmailButton>
    </EmailLayout>
  );
}
