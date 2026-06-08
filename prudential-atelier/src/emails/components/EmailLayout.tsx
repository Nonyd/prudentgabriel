import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { getPublicAppUrl } from "@/lib/app-url";
import { emailLogoWhiteUrl } from "@/lib/email-branding";

const APP = getPublicAppUrl();

type EmailLayoutProps = {
  children: ReactNode;
  previewText?: string;
  logoUrl?: string;
};

export default function EmailLayout({ children, previewText, logoUrl }: EmailLayoutProps) {
  const headerLogo = logoUrl ?? emailLogoWhiteUrl;

  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      {previewText ? <Preview>{previewText}</Preview> : null}
      <Body style={{ margin: 0, backgroundColor: "#F7F2EC", fontFamily: "Georgia, serif" }}>
        <Container style={{ maxWidth: 600, margin: "0 auto" }}>
          <Section style={{ backgroundColor: "#442913", padding: 24, textAlign: "center" as const }}>
            {headerLogo ? (
              <Img
                src={headerLogo}
                alt="Prudential Atelier"
                width={160}
                height={56}
                style={{ margin: "0 auto", objectFit: "contain" as const }}
              />
            ) : (
              <Text
                style={{
                  margin: 0,
                  color: "#C9A84C",
                  letterSpacing: 4,
                  fontSize: 14,
                  textTransform: "uppercase" as const,
                }}
              >
                Prudential Atelier
              </Text>
            )}
            <div style={{ height: 1, width: 80, margin: "16px auto 0", backgroundColor: "rgba(201,168,76,0.5)" }} />
          </Section>
          <Section style={{ backgroundColor: "#ffffff", padding: "40px 48px" }}>{children}</Section>
          <Section style={{ backgroundColor: "#1A0F08", padding: "24px 48px", textAlign: "center" as const }}>
            <Text style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(226,209,194,0.6)" }}>
              Prudential Atelier · prudentgabriel.com
            </Text>
            <Text style={{ margin: "0 0 8px", fontSize: 11, color: "rgba(226,209,194,0.6)", lineHeight: 1.6 }}>
              14 Bode Thomas Street, Surulere, Lagos, Nigeria
            </Text>
            <Text style={{ margin: "0 0 16px", fontSize: 11, color: "rgba(226,209,194,0.6)" }}>
              <Link href="mailto:hello@prudentgabriel.com" style={{ color: "rgba(226,209,194,0.6)" }}>
                hello@prudentgabriel.com
              </Link>
            </Text>
            <div style={{ height: 1, width: 80, margin: "0 auto 16px", backgroundColor: "#C9A84C" }} />
            <Text style={{ margin: 0, fontSize: 10, color: "rgba(226,209,194,0.45)" }}>
              Developed with love by SonsHub Media Ltd
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
