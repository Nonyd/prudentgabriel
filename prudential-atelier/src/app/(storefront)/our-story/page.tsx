import Image from "next/image";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { PFABanner } from "@/components/common/PFABanner";

export const revalidate = 86400;

export default function OurStoryPage() {
  return (
    <div>
      <div className="relative min-h-[70vh]">
        <Image
          src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1400"
          alt=""
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-charcoal/70" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-ivory">
          <SectionLabel light>EST. 2019 · LAGOS, NIGERIA</SectionLabel>
          <h1 className="mt-6 font-display text-5xl italic md:text-6xl">
            A Stitch
            <br />
            in Time
          </h1>
        </div>
      </div>

      <section className="mx-auto grid max-w-site items-center gap-12 px-4 py-20 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl text-wine">From Ajah to the World</h2>
          <p className="mt-4 font-body text-charcoal-mid leading-relaxed">
            What began in 2018 with a borrowed sewing machine and a spoiled dress, became one of Nigeria&apos;s most
            celebrated fashion ateliers.
          </p>
          <p className="mt-6 font-display text-xl italic text-wine">
            &ldquo;I didn&apos;t plan to be a fashion designer. I just couldn&apos;t let a spoiled dress defeat
            me.&rdquo;
          </p>
        </div>
        <div className="relative aspect-[3/4] overflow-hidden rounded-sm">
          <Image src="https://images.unsplash.com/photo-1519741497674-611481863552?w=800" alt="Atelier" fill className="object-cover" />
        </div>
      </section>

      <section className="bg-charcoal py-20 text-ivory">
        <div className="mx-auto grid max-w-site gap-12 px-4 lg:grid-cols-2 lg:items-center">
          <div className="relative aspect-[3/4] max-h-[480px]">
            <Image src="https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800" alt="Founder" fill className="object-cover" />
          </div>
          <div>
            <p className="font-label text-xs uppercase tracking-wider text-ivory/60">Founder & Creative Director</p>
            <h2 className="mt-2 font-display text-4xl text-gold">Mrs. Prudent Gabriel-Okopi</h2>
            <p className="mt-6 font-body text-ivory/80 leading-relaxed">
              Prudential Atelier brings Nigerian couture to the world stage — precision tailoring, rich textiles, and
              the warmth of Lagos craftsmanship in every piece.
            </p>
            <div className="mt-10">
              <SectionLabel light>DRESSED FOR THEIR GREATEST MOMENTS</SectionLabel>
              <div className="mt-4 grid grid-cols-2 gap-3 font-label text-xs text-gold md:grid-cols-3">
                {["Peggy Ovire", "Mercy Chinwo", "Mabel Makun", "Liquor Rose", "Mary Lazarus", "Miss Universe SA 2024"].map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-wine py-16 text-center text-ivory">
        <div className="mx-auto flex max-w-site flex-wrap justify-center gap-10 px-4 font-display text-2xl md:text-3xl">
          <span>5,000+ Graduates</span>
          <span>2019 Est.</span>
          <span>85+ Team</span>
          <span>4 Continents</span>
        </div>
      </section>

      <section className="bg-ivory-dark py-20 text-center">
        <SectionLabel>BEYOND THE ATELIER</SectionLabel>
        <h2 className="mx-auto mt-4 max-w-xl font-display text-3xl text-wine">Training the Next Generation</h2>
        <p className="mx-auto mt-4 max-w-lg font-body text-charcoal-mid">
          Through Prudential Fashion Academy, Mrs. Gabriel-Okopi has trained over 5,000 designers from across Nigeria
          and beyond.
        </p>
        <a
          href="https://pfacademy.ng"
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-block rounded-sm border border-gold px-6 py-2 font-label text-sm text-gold hover:bg-gold/10"
        >
          Visit PFA Academy →
        </a>
      </section>

      <PFABanner />
    </div>
  );
}
