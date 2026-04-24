import { Button, Heading, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";

type PasswordResetEmailProps = {
  resetUrl: string;
};

export default function PasswordResetEmail({ resetUrl }: PasswordResetEmailProps) {
  return (
    <EmailLayout previewText="Reset your password">
      <Heading as="h1" style={{ fontSize: 28, fontWeight: 400, color: "#2d2d2d", margin: "0 0 12px" }}>
        Reset your password
      </Heading>
      <Text style={{ fontSize: 16, color: "#2d2d2d" }}>
        We received a request to reset your Prudential Atelier password.
      </Text>
      <div style={{ marginTop: 28, textAlign: "center" as const }}>
        <Button
          href={resetUrl}
          style={{
            backgroundColor: "#6B1C2A",
            color: "#C9A84C",
            padding: "14px 36px",
            textDecoration: "none",
            fontSize: 16,
          }}
        >
          Reset password
        </Button>
      </div>
      <Text style={{ marginTop: 24, fontSize: 14, color: "#444" }}>This link expires in 1 hour.</Text>
      <Text style={{ fontSize: 14, color: "#444" }}>If you didn&apos;t request this, you can safely ignore this email.</Text>
      <Text style={{ marginTop: 16, fontSize: 13, color: "#666" }}>
        For your security, never share this link with anyone.
      </Text>
    </EmailLayout>
  );
}
