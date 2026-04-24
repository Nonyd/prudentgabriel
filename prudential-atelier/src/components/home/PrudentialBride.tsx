import Image from "next/image";
import Link from "next/link";

const DEF_HERO = "https://images.unsplash.com/photo-1594463750939-ebb28c3f7f75?w=1600&q=90";
const DEF_SIDE = "https://images.unsplash.com/photo-1519741347686-c1e331ec5e96?w=800&q=90";

function lines(text: string | undefined, fallback: string) {
  const t = text?.trim() ? text : fallback;
  return t.split("\n");
}

export function PrudentialBride({
  heroImage = DEF_HERO,
  portraitImage = DEF_SIDE,
  label = "PRUDENTIAL BRIDE",
  headline,
  body,
  cta1Text = "EXPLORE BRIDAL COLLECTION",
  cta2Text = "BOOK BRIDAL CONSULTATION",
}: {
  heroImage?: string;
  portraitImage?: string;
  label?: string;
  headline?: string;
  body?: string;
  cta1Text?: string;
  cta2Text?: string;
}) {
  const displayHeadline = lines(headline, "For the Bride\nWho Dares to\nBe Remembered.");
  const displayBody =
    body ??
    "Prudential Bride is our most intimate offering. Each gown is a singular creation — hand-crafted in our Lagos atelier, built around your story.";

  return (
    <section className="bg-bride-bg">
      <div className="relative h-[60vh] w-full md:h-[80vh]">
        <Image
          src={heroImage || DEF_HERO}
          alt="Prudential Bride"
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
        />
      </div>

      <div className="mx-auto max-w-[1400px] px-6 py-14 md:px-12 md:py-20">
        <div className="grid gap-12 md:grid-cols-2 md:items-center md:gap-16">
          <div>
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.25em] text-bride-accent">{label}</p>
            <h2 className="mt-4 font-display text-[36px] font-normal italic leading-none text-bride-dark md:text-[64px]">
              {displayHeadline.map((line, i) => (
                <span key={i}>
                  {line}
                  {i < displayHeadline.length - 1 ? <br /> : null}
                </span>
              ))}
            </h2>
            <p className="mt-6 max-w-md font-body text-[15px] font-light leading-[1.8] text-charcoal">{displayBody}</p>
            <div className="mt-10 flex flex-col items-start gap-4">
              <Link
                href="/shop?category=BRIDAL"
                className="inline-flex bg-bride-dark px-10 py-4 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-bride-bg transition-opacity hover:opacity-90"
              >
                {cta1Text}
              </Link>
              <Link
                href="/consultation"
                className="border-b border-bride-dark pb-0.5 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-bride-dark transition-opacity hover:opacity-70"
              >
                {cta2Text}
              </Link>
            </div>
          </div>
          <div>
            <div className="relative aspect-[3/4] w-full overflow-hidden">
              <Image
                src={portraitImage || DEF_SIDE}
                alt="Prudential Bride portrait"
                fill
                className="object-cover object-top"
                sizes="(max-width:768px) 100vw, 40vw"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
