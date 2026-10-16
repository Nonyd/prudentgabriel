import { Hr, Link, Section, Text } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";
import {
  EMAIL_CHOC,
  EMAIL_GOLD,
  EMAIL_INK,
  EMAIL_MUTED,
  EMAIL_SAND,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_UI,
} from "./components/email-tokens";

type Props = {
  firstName: string;
  /** The founder's words, paragraphs separated by a blank line (edited by a Super Admin). */
  paragraphs: string[];
  shopUrl: string;
};

/** A personal letter from Mrs Prudent Gabriel-Okopi, sent ten minutes after a client joins. */
export default function FounderNoteEmail({ firstName, paragraphs, shopUrl }: Props) {
  return (
    <EmailLayout family="relationship" previewText={`A personal note for you, ${firstName}`}>
      <Text
        style={{
          margin: "0 0 18px",
          textAlign: "center",
          fontFamily: FONT_UI,
          fontSize: 11,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: EMAIL_GOLD,
        }}
      >
        A note from the founder
      </Text>

      <Text
        style={{
          margin: "0 0 26px",
          textAlign: "center",
          fontFamily: FONT_DISPLAY,
          fontSize: 32,
          lineHeight: "38px",
          fontWeight: 400,
          fontStyle: "italic",
          color: EMAIL_CHOC,
        }}
      >
        Dear {firstName},
      </Text>

      <Section style={{ padding: "0 4px" }}>
        {paragraphs.map((p, i) => (
          <Text
            key={i}
            style={{
              margin: "0 0 18px",
              fontFamily: FONT_BODY,
              fontSize: 16,
              lineHeight: "28px",
              color: EMAIL_INK,
              whiteSpace: "pre-line",
            }}
          >
            {p}
          </Text>
        ))}
      </Section>

      <Section style={{ padding: "14px 4px 0" }}>
        <Text style={{ margin: "0 0 4px", fontFamily: FONT_BODY, fontSize: 15, color: EMAIL_MUTED }}>
          With love,
        </Text>
        <Text
          style={{
            margin: "0",
            fontFamily: FONT_DISPLAY,
            fontSize: 30,
            lineHeight: "36px",
            fontStyle: "italic",
            color: EMAIL_CHOC,
          }}
        >
          Prudent Gabriel-Okopi
        </Text>
        <Text
          style={{
            margin: "4px 0 0",
            fontFamily: FONT_UI,
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: EMAIL_MUTED,
          }}
        >
          Founder &amp; Creative Director
        </Text>
      </Section>

      <Hr style={{ border: "none", borderTop: `1px solid ${EMAIL_SAND}`, margin: "30px 0 18px" }} />

      <Text style={{ margin: 0, textAlign: "center", fontFamily: FONT_BODY, fontSize: 13, color: EMAIL_MUTED }}>
        <Link href={shopUrl} style={{ color: EMAIL_CHOC, textDecoration: "underline" }}>
          Explore the house
        </Link>
        {"  ·  "}
        You can reply to this email; it reaches the atelier.
      </Text>
    </EmailLayout>
  );
}
