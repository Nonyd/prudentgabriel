import Image from "next/image";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { PFABanner } from "@/components/common/PFABanner";
import { BrandStats } from "@/components/home/BrandStats";
import { Testimonials } from "@/components/home/Testimonials";
import { getImageSettings } from "@/lib/settings";

export const revalidate = 86400;

const DEF_STORY = "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1400";

export default async function OurStoryPage() {
  let storyHero = DEF_STORY;
  try {
    const img = await getImageSettings();
    if (img.img_our_story_hero?.trim()) storyHero = img.img_our_story_hero;
  } catch {
    /* default */
  }

  return (
    <div>
      <div className="relative h-[min(85vh,900px)] min-h-[420px]">
        <Image
          src={storyHero}
          alt=""
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-black/70" />
        <div className="absolute inset-0 flex flex-col justify-end px-6 pb-16 pt-24 md:px-16 md:pb-24">
          <SectionLabel light className="text-left text-white/50">
            Est. 2019 · Lagos, Nigeria
          </SectionLabel>
          <h1 className="mt-4 max-w-4xl text-left font-display text-[48px] font-normal italic leading-[0.95] text-white md:text-[80px]">
            A Stitch in Time.
          </h1>
        </div>
      </div>

      <section className="mx-auto grid max-w-site items-center gap-12 bg-white px-6 py-20 md:px-8 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-medium text-charcoal md:text-4xl">From Ajah to the World</h2>
          <p className="mt-4 font-body text-[15px] font-light leading-[1.85] text-dark-grey">
            What began in 2018 with a borrowed sewing machine and a spoiled dress, became one of Nigeria&apos;s most
            celebrated fashion ateliers.
          </p>
          <p className="mt-6 font-display text-xl font-normal italic text-olive">
            &ldquo;I didn&apos;t plan to be a fashion designer. I just couldn&apos;t let a spoiled dress defeat me.&rdquo;
          </p>
        </div>
        <div className="relative aspect-[3/4] overflow-hidden bg-light-grey">
          <Image src="https://images.unsplash.com/photo-1519741497674-611481863552?w=800" alt="Atelier" fill className="object-cover" />
        </div>
      </section>

      <section className="bg-black py-20 text-off-white">
        <div className="mx-auto grid max-w-site gap-12 px-6 md:px-8 lg:grid-cols-2 lg:items-center">
          <div className="relative aspect-[3/4] max-h-[520px] overflow-hidden bg-light-grey">
            <Image src="https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800" alt="Founder" fill className="object-cover" />
          </div>
          <div>
            <p className="font-body text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">Founder & Creative Director</p>
            <h2 className="mt-2 font-display text-4xl font-medium text-white">Mrs. Prudent Gabriel-Okopi</h2>
            <p className="mt-6 font-body text-[15px] font-light leading-[1.85] text-white/70">
              Prudent Gabriel brings Nigerian couture to the world stage — precision tailoring, rich textiles, and the warmth of
              Lagos craftsmanship in every piece.
            </p>
            <div className="mt-10">
              <SectionLabel light className="block text-left text-white/50">
                Dressed for their greatest moments
              </SectionLabel>
              <div className="mt-4 grid grid-cols-2 gap-3 font-body text-xs text-white/70 md:grid-cols-3">
                {["Peggy Ovire", "Mercy Chinwo", "Mabel Makun", "Liquor Rose", "Mary Lazarus", "Miss Universe SA 2024"].map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <BrandStats />

      <Testimonials />

      <section className="bg-off-white py-20 text-center">
        <SectionLabel>Beyond the Atelier</SectionLabel>
        <h2 className="mx-auto mt-4 max-w-xl font-display text-3xl font-normal italic text-charcoal md:text-4xl">
          Training the Next Generation
        </h2>
        <p className="mx-auto mt-4 max-w-lg font-body text-[15px] font-light leading-relaxed text-dark-grey">
          Through Prudential Fashion Academy, Mrs. Gabriel-Okopi has trained over 5,000 designers from across Nigeria and beyond.
        </p>
        <a
          href="https://pfacademy.ng"
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-block border border-black px-8 py-3 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-black transition-colors hover:bg-black hover:text-white"
        >
          Visit PFA Academy →
        </a>
      </section>

      <PFABanner />
    </div>
  );
}
