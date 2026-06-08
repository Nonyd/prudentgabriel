import { Button, Heading, Text } from "@react-email/components";
import EmailLayout from "@/emails/components/EmailLayout";

type ComposableTemplateEmailProps = {
  heading: string;
  body1: string;
  body2?: string;
  ctaLabel?: string;
  ctaLink?: string;
  footerNote?: string;
};

function paragraphLines(text: string) {
  return text.split("\n").filter((line) => line.length > 0);
}

export default function ComposableTemplateEmail({
  heading,
  body1,
  body2,
  ctaLabel,
  ctaLink,
  footerNote,
}: ComposableTemplateEmailProps) {
  return (
    <EmailLayout previewText={heading}>
      <Heading
        as="h2"
        style={{
          margin: "0 0 20px",
          fontSize: 22,
          fontWeight: 400,
          color: "#442913",
          fontFamily: "Georgia, serif",
        }}
      >
        {heading}
      </Heading>
      {paragraphLines(body1).map((line) => (
        <Text
          key={`b1-${line}`}
          style={{
            margin: "0 0 14px",
            fontSize: 15,
            lineHeight: 1.7,
            color: "#3D3D3A",
            fontFamily: "Georgia, serif",
          }}
        >
          {line}
        </Text>
      ))}
      {body2
        ? paragraphLines(body2).map((line) => (
            <Text
              key={`b2-${line}`}
              style={{
                margin: "0 0 14px",
                fontSize: 15,
                lineHeight: 1.7,
                color: "#3D3D3A",
                fontFamily: "Georgia, serif",
              }}
            >
              {line}
            </Text>
          ))
        : null}
      {ctaLabel && ctaLink ? (
        <Button
          href={ctaLink}
          style={{
            marginTop: 8,
            marginBottom: 16,
            backgroundColor: "#442913",
            color: "#ffffff",
            padding: "12px 24px",
            borderRadius: 2,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          {ctaLabel}
        </Button>
      ) : null}
      {footerNote ? (
        <Text
          style={{
            margin: "16px 0 0",
            fontSize: 12,
            lineHeight: 1.6,
            color: "#6B6B68",
            fontFamily: "Georgia, serif",
          }}
        >
          {footerNote}
        </Text>
      ) : null}
    </EmailLayout>
  );
}
