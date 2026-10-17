import { Text } from "@react-email/components";
import EmailButton from "./components/EmailButton";
import type { LoyaltyTier } from "@prisma/client";
import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import { getPublicAppUrl } from "@/lib/app-url";
import { TIER_LABELS } from "@/lib/loyalty";
import EmailLayout from "./components/EmailLayout";

const APP = getPublicAppUrl();

export type LoyaltyTierCorrectionEmailProps = {
  firstName: string;
  announcedTier: LoyaltyTier;
  announcedOn: string;
  correctTier: LoyaltyTier;
  /** Optional paragraph the house adds before sending, e.g. a goodwill gesture. */
  note?: string | null;
};

const body = { fontSize: 16, color: "#333", lineHeight: 1.6, margin: "0 0 16px" } as const;

export default function LoyaltyTierCorrectionEmail({
  firstName,
  announcedTier,
  announcedOn,
  correctTier,
  note,
}: LoyaltyTierCorrectionEmailProps) {
  return (
    <EmailLayout family="relationship" previewText={`A correction about your Prudent Points tier — ${CUSTOMER_HOUSE_NAME}`}>
      <Text style={body}>Dear {firstName},</Text>
      <Text style={body}>
        On {announcedOn}, we sent you a message saying you had reached {TIER_LABELS[announcedTier]} status in Prudent
        Points. That message was sent in error, and we are sorry for any confusion it caused.
      </Text>
      <Text style={body}>
        Our tiers are based on what a client spends with the house over a calendar year. Your current tier is{" "}
        <strong>{TIER_LABELS[correctTier]}</strong>.
      </Text>
      <Text style={body}>
        Your Prudent Points balance has not changed. Every point you have earned is still yours to use towards a
        future piece.
      </Text>
      {note?.trim() ? <Text style={body}>{note.trim()}</Text> : null}
      <EmailButton href={`${APP}/account/loyalty`}>View your Prudent Points</EmailButton>
    </EmailLayout>
  );
}
