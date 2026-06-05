import Image from "next/image";
import Link from "next/link";
import { PFABanner } from "@/components/common/PFABanner";
import { getContent, getContentSettings, getImageSettings } from "@/lib/settings";

export const revalidate = 300;

const DEFAULT_STORY =
  "Founded in Lagos, Prudential Atelier crafts ready-to-wear, bridal, and made-to-measure commissions for women who expect more from what they wear. Every piece is designed and constructed in our atelier with the same precision whether it ships worldwide or is tailored to your measurements.";

export default async function AboutPage() {
  let storyBody = DEFAULT_STORY;
  let storyHero = "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1400";

  try {
    const [content, images] = await Promise.all([getContentSettings(), getImageSettings()]);
    storyBody = getContent(content, "page_about", storyBody);
    if (images.img_our_story_hero?.trim()) storyHero = images.img_our_story_hero;
  } catch {
    /* defaults */
  }

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
          The House of Prudent Gabriel
        </h1>
        <p
          className="mx-auto mt-4 max-w-lg"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "16px",
            color: "var(--sand)",
          }}
        >
          Founded in Lagos. Worn around the world.
        </p>
      </section>

      <section className="mx-auto grid max-w-site items-center gap-12 bg-ivory px-6 py-20 lg:grid-cols-2 lg:px-10">
        <div
          className="whitespace-pre-line font-light leading-relaxed"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "15px",
            color: "var(--text-mid)",
            lineHeight: 1.85,
          }}
        >
          {storyBody}
        </div>
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
          &ldquo;I didn&apos;t plan to be a fashion designer. I just couldn&apos;t let a spoiled dress defeat me.&rdquo;
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
          — Mrs. Prudent Gabriel, Founder
        </p>
      </section>

      <section className="bg-ivory px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-site text-center">
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "32px",
              color: "var(--choc)",
            }}
          >
            Our team
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

      <PFABanner />
    </div>
  );
}
