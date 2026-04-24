import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { getPublicAppUrl } from "@/lib/app-url";

const APP = getPublicAppUrl();

type EmailLayoutProps = {
  children: ReactNode;
  previewText?: string;
};

export default function EmailLayout({ children, previewText }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      {previewText ? <Preview>{previewText}</Preview> : null}
      <Body style={{ margin: 0, backgroundColor: "#FAF6EF", fontFamily: "Georgia, serif" }}>
        <Container style={{ maxWidth: 600, margin: "0 auto" }}>
          <Section style={{ backgroundColor: "#6B1C2A", padding: 24, textAlign: "center" as const }}>
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
            <div style={{ height: 1, width: 80, margin: "16px auto 0", backgroundColor: "rgba(201,168,76,0.5)" }} />
          </Section>
          <Section style={{ backgroundColor: "#ffffff", padding: "40px 48px" }}>{children}</Section>
          <Section style={{ backgroundColor: "#1A1A1A", padding: "24px 48px", textAlign: "center" as const }}>
            <Text style={{ margin: "0 0 12px", fontSize: 12, color: "rgba(250,246,239,0.6)" }}>
              <Link href={`${APP}/shop`} style={{ color: "rgba(250,246,239,0.6)", marginRight: 12 }}>
                Shop
              </Link>
              <Link href={`${APP}/bespoke`} style={{ color: "rgba(250,246,239,0.6)", marginRight: 12 }}>
                Bespoke
              </Link>
              <Link href={`${APP}/our-story`} style={{ color: "rgba(250,246,239,0.6)", marginRight: 12 }}>
                Our Story
              </Link>
              <Link href={`${APP}/contact`} style={{ color: "rgba(250,246,239,0.6)" }}>
                Contact
              </Link>
            </Text>
            <Text style={{ margin: 0, fontSize: 11, color: "rgba(250,246,239,0.4)" }}>
              © {new Date().getFullYear()} Prudential Atelier · Lagos, Nigeria
            </Text>
            <Text style={{ margin: "12px 0 0", fontSize: 11, color: "rgba(250,246,239,0.35)" }}>
              You received this email because you have an account or placed an order with us.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
