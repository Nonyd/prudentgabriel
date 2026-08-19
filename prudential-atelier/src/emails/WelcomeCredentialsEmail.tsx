import { Button, Heading, Section, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";

type Props = {
  firstName: string;
  email: string;
  tempPassword: string;
  sourceLabel: string;
  trackUrl: string;
  loginUrl: string;
};

export function subjectWelcomeCredentials(firstName: string): string {
  return `Welcome to Prudential Atelier, ${firstName} — your account is ready`;
}

export default function WelcomeCredentialsEmail({
  firstName,
  email,
  tempPassword,
  sourceLabel,
  trackUrl,
  loginUrl,
}: Props) {
  return (
    <EmailLayout previewText={`Your Prudential Atelier account is ready, ${firstName}`}>
      <Heading className="font-serif text-2xl text-[#442913]">Welcome, {firstName}.</Heading>
      <Text className="text-[#2a1a0e]">
        Your account has been created so you can follow your {sourceLabel} with us.
      </Text>

      <Section className="my-6 rounded border border-[#E8E0D4] bg-[#FAF7F2] p-5">
        <Text className="m-0 text-xs uppercase tracking-wider text-[#8B7355]">Your login details</Text>
        <Text className="mb-1 mt-3 text-sm text-[#2A1A0E]">
          <strong>Email:</strong> {email}
        </Text>
        <Text className="m-0 text-sm text-[#2A1A0E]">
          <strong>Temporary password:</strong> {tempPassword}
        </Text>
        <Button href={loginUrl} className="mt-4 rounded bg-[#442913] px-6 py-3 text-sm text-[#F7F2EC]">
          Log in at prudentgabriel.com
        </Button>
      </Section>

      <Section className="my-6">
        <Text className="text-xs uppercase tracking-wider text-[#8B7355]">Track your order (no login needed)</Text>
        <Text className="text-sm text-[#2a1a0e]">Follow your commission at any time:</Text>
        <Button href={trackUrl} className="mt-3 rounded bg-[#442913] px-6 py-3 text-sm text-[#F7F2EC]">
          Track my order
        </Button>
      </Section>

      <Text className="text-sm text-[#2a1a0e]">Once you&apos;re logged in, you can:</Text>
      <Text className="text-sm text-[#2a1a0e]">✓ See your measurements saved forever</Text>
      <Text className="text-sm text-[#2a1a0e]">✓ View your moodboard and design references</Text>
      <Text className="text-sm text-[#2a1a0e]">✓ Earn loyalty points on every order</Text>
      <Text className="text-sm text-[#2a1a0e]">✓ Refer friends and earn ₦5,000 credit</Text>
      <Text className="text-sm text-[#2a1a0e]">✓ Book your next consultation in seconds</Text>
    </EmailLayout>
  );
}
