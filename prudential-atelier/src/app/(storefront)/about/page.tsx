import Image from "next/image";
import Link from "next/link";
import { PFACrosslinkBannerClient } from "@/components/public/PFACrosslinkBannerClient";
import { cmsBool, cmsGet, cmsJson, getCMSContent } from "@/lib/cms";
import { readyToWearCtaHref } from "@/lib/rtw-aisle";
import { DEFAULT_ABOUT_VALUES } from "@/lib/page-content-defaults";
import { getImageSettings } from "@/lib/settings";

export const revalidate = 300;

const ABOUT_KEYS = [
  "about_hero_headline",
  "about_hero_subtext",
  "about_story_eyebrow",
  "about_story_headline",
  "about_story_paragraph_1",
  "about_story_paragraph_2",
  "about_story_paragraph_3",
  "about_story_image",
  "about_founder_name",
  "about_founder_title",
  "about_founder_photo",
  "about_founder_bio_1",
  "about_founder_bio_2",
  "about_founder_bio_3",
  "about_founder_quote",
  "about_stat_1_number",
  "about_stat_1_label",
  "about_stat_2_number",
  "about_stat_2_label",
  "about_stat_3_number",
  "about_stat_3_label",
  "about_stat_4_number",
  "about_stat_4_label",
  "about_values_eyebrow",
  "about_values_headline",
  "about_values",
  "about_locations_eyebrow",
  "about_locations_headline",
  "about_lagos_name",
  "about_lagos_address",
  "about_lagos_hours",
  "about_lagos_maps_link",
  "about_abuja_name",
  "about_abuja_address",
  "about_abuja_hours",
  "about_abuja_maps_link",
  "about_academy_enabled",
  "about_academy_headline",
  "about_academy_body",
  "about_academy_cta_label",
  "about_academy_cta_link",
  "about_cta_headline",
  "about_cta_quote",
  "about_cta_button_1_label",
  "about_cta_button_1_link",
  "about_cta_button_2_label",
  "about_cta_button_2_link",
] as const;

const HERO_STRIP_IMAGES = [
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&q=80",
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80",
  "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80",
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80",
];

function Eyebrow({ children: _children }: { children: React.ReactNode }) {
  return null;
}

export default async function AboutPage() {
  let cms: Record<string, string> = {};
  let storyHero = "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1400&q=80";
  const founderPhoto = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80";

  try {
    const [content, images] = await Promise.all([getCMSContent([...ABOUT_KEYS]), getImageSettings()]);
    cms = content;
    if (images.img_our_story_hero?.trim()) storyHero = images.img_our_story_hero;
  } catch {
    /* defaults */
  }

  const storyImage = cmsGet(cms, "about_story_image", "") || storyHero;
  const founderImage = cmsGet(cms, "about_founder_photo", "") || founderPhoto;
  const values = cmsJson(cms, "about_values", DEFAULT_ABOUT_VALUES);
  const showAcademy = cmsBool(cms, "about_academy_enabled", true);

  const stats = [
    { number: cmsGet(cms, "about_stat_1_number", "15+"), label: cmsGet(cms, "about_stat_1_label", "Years of Couture") },
    {
      number: cmsGet(cms, "about_stat_2_number", "500+"),
      label: cmsGet(cms, "about_stat_2_label", "Commissions Delivered"),
    },
    {
      number: cmsGet(cms, "about_stat_3_number", "10,000+"),
      label: cmsGet(cms, "about_stat_3_label", "Happy Clients"),
    },
    { number: cmsGet(cms, "about_stat_4_number", "4"), label: cmsGet(cms, "about_stat_4_label", "Atelier Locations") },
  ];

  const locations = [
    {
      name: cmsGet(cms, "about_lagos_name", "LAGOS"),
      address: cmsGet(cms, "about_lagos_address", "14 Bode Thomas Street\nSurulere, Lagos"),
      hours: cmsGet(cms, "about_lagos_hours", "Mon–Fri: 9am–6pm · Sat: 10am–4pm"),
      maps: cmsGet(cms, "about_lagos_maps_link", "https://maps.google.com/?q=Surulere,Lagos,Nigeria"),
    },
    {
      name: cmsGet(cms, "about_abuja_name", "ABUJA"),
      address: cmsGet(cms, "about_abuja_address", "Plot 1234, Wuse Zone 5\nAbuja, FCT"),
      hours: cmsGet(cms, "about_abuja_hours", "Mon–Fri: 9am–6pm · Sat: 10am–4pm"),
      maps: cmsGet(cms, "about_abuja_maps_link", "https://maps.google.com/?q=Wuse+Zone+5,Abuja,Nigeria"),
    },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative flex min-h-[70vh] flex-col items-center justify-center px-6 py-24 text-center lg:px-10">
        <div className="glass-1 glass-panel max-w-3xl px-8 py-12">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.5rem, 6vw, 64px)",
            fontWeight: 400,
            color: "var(--choc)",
            lineHeight: 1.1,
          }}
        >
          {cmsGet(cms, "about_hero_headline", "The House of Prudent Gabriel")}
        </h1>
        <p
          className="mx-auto mt-5 max-w-2xl"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "18px",
            color: "var(--text-mid)",
          }}
        >
          {cmsGet(cms, "about_hero_subtext", "Founded in Lagos. Worn around the world.")}
        </p>
        </div>
        <div className="mx-auto mt-14 grid w-full max-w-site grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {HERO_STRIP_IMAGES.map((src, i) => (
            <div key={src} className="relative aspect-[4/5] overflow-hidden rounded-sm">
              <Image src={src} alt="" fill className="object-cover" sizes="(max-width:768px) 50vw, 25vw" priority={i < 2} />
            </div>
          ))}
        </div>
      </section>

      {/* Brand story */}
      <section className="mx-auto grid max-w-site items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:px-10">
        <div className="relative aspect-[3/4] overflow-hidden bg-sand/20">
          <Image src={storyImage} alt="Prudential Atelier" fill className="object-cover object-top" sizes="(max-width:1024px) 100vw, 50vw" />
        </div>
        <div>
          <Eyebrow>{cmsGet(cms, "about_story_eyebrow", "OUR STORY")}</Eyebrow>
          <h2
            className="mt-3"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "42px",
              fontWeight: 400,
              color: "var(--choc)",
              lineHeight: 1.15,
            }}
          >
            {cmsGet(cms, "about_story_headline", "From a dream to a dynasty.")}
          </h2>
          <div
            className="mt-8 space-y-5"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "15px",
              color: "var(--text-mid)",
              lineHeight: 1.9,
            }}
          >
            <p>{cmsGet(cms, "about_story_paragraph_1", "")}</p>
            <p>{cmsGet(cms, "about_story_paragraph_2", "")}</p>
            <p>{cmsGet(cms, "about_story_paragraph_3", "")}</p>
          </div>
        </div>
      </section>

      {/* Founder */}
      <section className="bg-choc px-6 py-20 lg:px-10">
        <div className="mx-auto grid max-w-site items-center gap-12 lg:grid-cols-2">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden bg-nut/20">
            <Image src={founderImage} alt={cmsGet(cms, "about_founder_name", "Founder")} fill className="object-cover object-top" sizes="(max-width:1024px) 100vw, 40vw" />
          </div>
          <div>
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
              THE CREATIVE DIRECTOR
            </p>
            <h2
              className="mt-4"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 4vw, 48px)",
                color: "var(--cream)",
                lineHeight: 1.1,
              }}
            >
              {cmsGet(cms, "about_founder_name", "Mrs. Prudent Gabriel-Okopi")}
            </h2>
            <p
              className="mt-2 uppercase"
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "12px",
                letterSpacing: "0.14em",
                color: "var(--lightbr)",
              }}
            >
              {cmsGet(cms, "about_founder_title", "Founder & Creative Director")} · Prudential Atelier
            </p>
            <div
              className="mt-8 space-y-5"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "15px",
                color: "rgba(250,246,240,0.8)",
                lineHeight: 1.9,
              }}
            >
              <p>{cmsGet(cms, "about_founder_bio_1", "")}</p>
              <p>{cmsGet(cms, "about_founder_bio_2", "")}</p>
              <p>{cmsGet(cms, "about_founder_bio_3", "")}</p>
            </div>
            <blockquote
              className="mt-10 italic"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "24px",
                color: "var(--cream)",
                lineHeight: 1.45,
              }}
            >
              &ldquo;{cmsGet(cms, "about_founder_quote", "We don't make clothes. We make the way you'll be remembered.")}&rdquo;
            </blockquote>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 py-20 lg:px-10">
        <div className="mx-auto grid max-w-site grid-cols-2 gap-10 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="mx-auto mb-4 h-px w-6" style={{ backgroundColor: "#C9A84C" }} />
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(2.5rem, 5vw, 64px)",
                  color: "var(--choc)",
                  lineHeight: 1,
                }}
              >
                {stat.number}
              </p>
              <p
                className="mt-3 uppercase"
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: "11px",
                  letterSpacing: "0.2em",
                  color: "var(--text-light)",
                }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="bg-cream px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-site text-center">
          <Eyebrow>{cmsGet(cms, "about_values_eyebrow", "WHAT WE STAND FOR")}</Eyebrow>
          <h2
            className="mt-3"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "42px",
              color: "var(--choc)",
            }}
          >
            {cmsGet(cms, "about_values_headline", "The principles behind every piece")}
          </h2>
        </div>
        <div className="mx-auto mt-14 grid max-w-site gap-6 md:grid-cols-2 lg:grid-cols-3">
          {values.map((value) => (
            <div
              key={value.name}
              className="glass-2 glass-panel p-7"
              style={{ borderWidth: "0.5px" }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "22px",
                  color: "var(--choc)",
                }}
              >
                {value.name}
              </h3>
              <div className="my-4 h-px w-6" style={{ backgroundColor: "#C9A84C" }} />
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "13px",
                  color: "var(--text-mid)",
                  lineHeight: 1.8,
                }}
              >
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Locations */}
      <section className="px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-site text-center">
          <Eyebrow>{cmsGet(cms, "about_locations_eyebrow", "OUR ATELIERS")}</Eyebrow>
          <h2
            className="mt-3"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "42px",
              color: "var(--choc)",
            }}
          >
            {cmsGet(cms, "about_locations_headline", "Where to find us")}
          </h2>
        </div>
        <div className="mx-auto mt-14 grid max-w-site gap-8 md:grid-cols-2">
          {locations.map((loc) => (
            <article key={loc.name} className="overflow-hidden rounded-sm border border-sand bg-cream" style={{ borderWidth: "0.5px" }}>
              <div className="relative aspect-[16/9] bg-sand/30">
                <iframe
                  title={`${loc.name} map`}
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(loc.address.replace("\n", ", "))}&output=embed`}
                  className="absolute inset-0 h-full w-full border-0"
                  loading="lazy"
                />
              </div>
              <div className="p-7">
                <h3
                  className="uppercase"
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: "11px",
                    letterSpacing: "0.18em",
                    color: "var(--lightbr)",
                  }}
                >
                  {loc.name}
                </h3>
                <p
                  className="mt-3 whitespace-pre-line"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "14px",
                    color: "var(--text-mid)",
                    lineHeight: 1.7,
                  }}
                >
                  {loc.address}
                </p>
                <p
                  className="mt-4"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "13px",
                    color: "var(--text-light)",
                  }}
                >
                  {loc.hours}
                </p>
                <a
                  href={loc.maps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-block uppercase hover:underline"
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: "10px",
                    fontWeight: 600,
                    letterSpacing: "0.16em",
                    color: "var(--nut)",
                  }}
                >
                  Get Directions →
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* PFA */}
      {showAcademy ? (
        <section id="academy">
          <PFACrosslinkBannerClient
            cms={{
              home_pfa_eyebrow: "PRUDENTIAL FASHION ACADEMY",
              home_pfa_headline: cmsGet(cms, "about_academy_headline", "Learn the craft from the house"),
              home_pfa_body: cmsGet(cms, "about_academy_body", "Over 5,000 designers trained. The school behind the brand."),
              home_pfa_button_label: cmsGet(cms, "about_academy_cta_label", "Explore PFA →"),
              home_pfa_button_link: cmsGet(cms, "about_academy_cta_link", "/about#academy"),
            }}
          />
        </section>
      ) : null}

      {/* CTA */}
      <section className="px-6 py-24 text-center lg:px-10">
        <div className="glass-2 glass-panel mx-auto max-w-2xl px-8 py-12">
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.75rem, 4vw, 40px)",
            color: "var(--choc)",
          }}
        >
          {cmsGet(cms, "about_cta_headline", "Ready to begin your commission?")}
        </h2>
        <p
          className="mx-auto mt-4 max-w-md italic"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "16px",
            color: "var(--text-mid)",
          }}
        >
          &ldquo;{cmsGet(cms, "about_cta_quote", "Every great piece begins with a conversation.")}&rdquo;
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href={cmsGet(cms, "about_cta_button_1_link", "/consultation")}
            className="inline-flex min-w-[220px] items-center justify-center rounded-[3px] px-8 py-3 uppercase"
            style={{
              backgroundColor: "var(--cream)",
              color: "var(--choc)",
              fontFamily: "var(--font-ui)",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.16em",
            }}
          >
            {cmsGet(cms, "about_cta_button_1_label", "BOOK A CONSULTATION →")}
          </Link>
          <Link
            href={readyToWearCtaHref(cmsGet(cms, "about_cta_button_2_link", "/rtw"))}
            className="inline-flex min-w-[220px] items-center justify-center rounded-[3px] border px-8 py-3 uppercase"
            style={{
              borderColor: "var(--sand)",
              color: "var(--cream)",
              fontFamily: "var(--font-ui)",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.16em",
            }}
          >
            {cmsGet(cms, "about_cta_button_2_label", "BROWSE THE COLLECTION →")}
          </Link>
        </div>
        <p className="mt-6 font-body text-sm text-text-mid">
          Interested in joining our team?{" "}
          <Link href="/careers" className="underline underline-offset-2 hover:text-choc">
            View open positions
          </Link>
        </p>
        </div>
      </section>
    </div>
  );
}
