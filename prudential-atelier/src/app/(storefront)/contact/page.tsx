import { FacebookIcon, InstagramIcon, TikTokIcon } from "@/components/icons/SocialIcons";
import { ContactForm } from "@/components/contact/ContactForm";
import { cmsGet, getCMSContent } from "@/lib/cms";

export const revalidate = 300;

const CONTACT_KEYS = [
  "contact_lagos_address_1",
  "contact_lagos_address_2",
  "contact_abuja_address_1",
  "contact_abuja_address_2",
  "contact_whatsapp",
  "contact_phone",
  "contact_email",
  "contact_hours_weekday",
  "contact_hours_saturday",
  "contact_instagram",
  "contact_tiktok",
  "contact_facebook",
  "contact_auto_reply_message",
] as const;

function whatsAppHref(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "#";
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.16em",
          color: "var(--lightbr)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <div
        className="mt-1"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "14px",
          color: "var(--text-mid)",
          lineHeight: 1.7,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default async function ContactPage() {
  let cms: Record<string, string> = {};
  try {
    cms = await getCMSContent([...CONTACT_KEYS]);
  } catch {
    /* defaults */
  }

  const lagos1 = cmsGet(cms, "contact_lagos_address_1", "14 Bode Thomas Street");
  const lagos2 = cmsGet(cms, "contact_lagos_address_2", "Surulere, Lagos, Nigeria");
  const abuja1 = cmsGet(cms, "contact_abuja_address_1", "Plot 1234, Wuse Zone 5");
  const abuja2 = cmsGet(cms, "contact_abuja_address_2", "Abuja, FCT, Nigeria");
  const whatsapp = cmsGet(cms, "contact_whatsapp", "+2348012345678");
  const phone = cmsGet(cms, "contact_phone", "+2348012345678");
  const email = cmsGet(cms, "contact_email", "hello@prudentgabriel.com");
  const hoursWeekday = cmsGet(cms, "contact_hours_weekday", "Monday – Friday: 9:00 AM – 6:00 PM");
  const hoursSaturday = cmsGet(cms, "contact_hours_saturday", "Saturday: 10:00 AM – 4:00 PM");
  const instagram = cmsGet(cms, "contact_instagram", "@prudentgabriel");
  const tiktok = cmsGet(cms, "contact_tiktok", "@prudentgabriel");
  const facebook = cmsGet(cms, "contact_facebook", "Prudential Atelier");
  const autoReply = cmsGet(cms, "contact_auto_reply_message", "We'll be in touch within 24 hours.");

  return (
    <div className="bg-ivory">
      <header className="border-b border-sand/60 px-6 py-16 text-center lg:px-10 lg:py-20">
        <p
          className="uppercase"
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.2em",
            color: "var(--lightbr)",
          }}
        >
          Contact
        </p>
        <h1
          className="mt-3"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.5rem, 5vw, 56px)",
            fontWeight: 400,
            color: "var(--choc)",
          }}
        >
          Get in touch
        </h1>
        <p
          className="mx-auto mt-4 max-w-lg"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "16px",
            color: "var(--text-mid)",
          }}
        >
          We&apos;d love to hear from you.
        </p>
      </header>

      <div className="mx-auto grid max-w-site gap-12 px-6 py-16 lg:grid-cols-[55fr_45fr] lg:gap-16 lg:px-10 lg:py-20">
        <ContactForm autoReplyHint={autoReply} />

        <aside className="space-y-8 lg:pt-2">
          <div>
            <h2
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.18em",
                color: "var(--choc)",
              }}
            >
              FIND US
            </h2>
            <div className="mt-2 h-px w-full bg-sand" />
            <div className="mt-6 space-y-6">
              <DetailBlock label="📍 Lagos Atelier">
                {lagos1}
                <br />
                {lagos2}
              </DetailBlock>
              <DetailBlock label="📍 Abuja Studio">
                {abuja1}
                <br />
                {abuja2}
              </DetailBlock>
            </div>
          </div>

          <div className="h-px bg-sand" />

          <div>
            <h2
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.18em",
                color: "var(--choc)",
              }}
            >
              GET IN TOUCH
            </h2>
            <div className="mt-2 h-px w-full bg-sand" />
            <div className="mt-6 space-y-6">
              <DetailBlock label="📱 WhatsApp">
                {whatsapp}
                <br />
                <a
                  href={whatsAppHref(whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block hover:underline"
                  style={{ color: "var(--nut)" }}
                >
                  Chat on WhatsApp →
                </a>
              </DetailBlock>
              <DetailBlock label="📞 Phone">{phone}</DetailBlock>
              <DetailBlock label="✉ Email">
                <a href={`mailto:${email}`} className="hover:underline">
                  {email}
                </a>
              </DetailBlock>
              <DetailBlock label="⏰ Hours">
                {hoursWeekday}
                <br />
                {hoursSaturday}
                <br />
                Sunday: Closed
              </DetailBlock>
            </div>
          </div>

          <div className="h-px bg-sand" />

          <div>
            <h2
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.18em",
                color: "var(--choc)",
              }}
            >
              FOLLOW US
            </h2>
            <div className="mt-2 h-px w-full bg-sand" />
            <ul className="mt-6 space-y-3">
              <li className="flex items-center gap-3">
                <InstagramIcon size={16} className="text-lightbr" />
                <span style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "var(--text-mid)" }}>
                  {instagram}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <TikTokIcon size={16} className="text-lightbr" />
                <span style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "var(--text-mid)" }}>
                  {tiktok}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <FacebookIcon size={16} className="text-lightbr" />
                <span style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "var(--text-mid)" }}>
                  {facebook}
                </span>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <div className="mx-auto max-w-site px-6 pb-20 lg:px-10">
        <iframe
          title="Lagos Atelier location"
          src="https://maps.google.com/maps?q=Surulere,Lagos,Nigeria&output=embed"
          width="100%"
          height={400}
          loading="lazy"
          className="rounded-lg border-0"
          style={{ border: 0 }}
        />
      </div>
    </div>
  );
}
