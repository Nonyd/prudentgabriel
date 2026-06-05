import Image from "next/image";
import Link from "next/link";
import { PFABanner } from "@/components/common/PFABanner";
import { cmsBool, cmsGet, getCMSContent } from "@/lib/cms";
import { getImageSettings } from "@/lib/settings";

export const revalidate = 300;

const ABOUT_KEYS = [
  "about_hero_headline",
  "about_hero_subtext",
  "about_story_body",
  "about_founder_quote",
  "about_founder_name",
  "about_founder_title",
  "about_academy_enabled",
  "about_academy_headline",
  "about_academy_body",
  "about_academy_cta_label",
  "about_academy_cta_link",
  "about_team_enabled",
  "about_team_headline",
] as const;

export default async function AboutPage() {
  let storyHero = "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1400";
  let cms: Record<string, string> = {};

  try {
    const [content, images] = await Promise.all([getCMSContent([...ABOUT_KEYS]), getImageSettings()]);
    cms = content;
    if (images.img_our_story_hero?.trim()) storyHero = images.img_our_story_hero;
  } catch {
    /* defaults */
  }

  const heroHeadline = cmsGet(cms, "about_hero_headline", "The House of Prudent Gabriel");
  const heroSubtext = cmsGet(cms, "about_hero_subtext", "Founded in Lagos. Worn around the world.");
  const storyHtml = cmsGet(
    cms,
    "about_story_body",
    "<p>Founded in Lagos, Prudential Atelier crafts ready-to-wear, bridal, and made-to-measure commissions for women who expect more from what they wear.</p>",
  );
  const founderQuote = cmsGet(
    cms,
    "about_founder_quote",
    "I didn't plan to be a fashion designer. I just couldn't let a spoiled dress defeat me.",
  );
  const founderName = cmsGet(cms, "about_founder_name", "Mrs. Prudent Gabriel");
  const founderTitle = cmsGet(cms, "about_founder_title", "Founder");
  const showTeam = cmsBool(cms, "about_team_enabled", false);
  const teamHeadline = cmsGet(cms, "about_team_headline", "Our team");

  return (
    <div>
      <section className="bg-choc px-6 py-24 text-center lg:px-10 lg:py-32">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 5vw, 52px)",
            color: "var(--cream)",
            fontWeight: 400,
          }}
        >
          {heroHeadline}
        </h1>
        <p
          className="mx-auto mt-4 max-w-lg"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "16px",
            color: "var(--sand)",
          }}
        >
          {heroSubtext}
        </p>
      </section>

      <section className="mx-auto grid max-w-site items-center gap-12 bg-ivory px-6 py-20 lg:grid-cols-2 lg:px-10">
        <div
          className="legal-content font-light leading-relaxed"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "15px",
            color: "var(--text-mid)",
            lineHeight: 1.85,
          }}
          dangerouslySetInnerHTML={{ __html: storyHtml }}
        />
        <div className="relative aspect-[3/4] overflow-hidden bg-sand/20">
          <Image src={storyHero} alt="Prudent Gabriel atelier" fill className="object-cover object-top" priority />
        </div>
      </section>

      <section className="bg-cream px-6 py-16 text-center lg:px-10">
        <blockquote
          className="mx-auto max-w-2xl italic"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "22px",
            color: "var(--choc)",
          }}
        >
          &ldquo;{founderQuote}&rdquo;
        </blockquote>
        <p
          className="mt-4 uppercase"
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "10px",
            letterSpacing: "0.18em",
            color: "var(--lightbr)",
          }}
        >
          — {founderName}, {founderTitle}
        </p>
      </section>

      {showTeam ? (
        <section className="bg-ivory px-6 py-20 lg:px-10">
          <div className="mx-auto max-w-site text-center">
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "32px",
                color: "var(--choc)",
              }}
            >
              {teamHeadline}
            </h2>
            <p
              className="mx-auto mt-4 max-w-md"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                color: "var(--text-mid)",
              }}
            >
              Team portraits coming soon. In the meantime,{" "}
              <Link href="/consultation" className="underline hover:text-choc">
                book a consultation
              </Link>{" "}
              to meet our atelier team.
            </p>
          </div>
        </section>
      ) : null}

      <PFABanner />
    </div>
  );
}
