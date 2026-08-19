import { Button, Heading, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";

type Props = { loginUrl: string };

export default function AccountExistsEmail({ loginUrl }: Props) {
  return (
    <EmailLayout previewText="You already have an account">
      <Heading as="h1" style={{ fontSize: 28, fontWeight: 400, color: "#2d2d2d", margin: "0 0 12px" }}>
        You already have an account
      </Heading>
      <Text style={{ fontSize: 16, color: "#2d2d2d" }}>
        Someone tried to register with this email. If that was you, sign in instead.
      </Text>
      <div style={{ marginTop: 28, textAlign: "center" as const }}>
        <Button
          href={loginUrl}
          style={{
            backgroundColor: "#442913",
            color: "#C9A84C",
            padding: "14px 36px",
            textDecoration: "none",
            fontSize: 16,
          }}
        >
          Sign in
        </Button>
      </div>
    </EmailLayout>
  );
}
