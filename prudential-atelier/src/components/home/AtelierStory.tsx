import Image from "next/image";
import Link from "next/link";

const IMG_L = "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200&q=90";
const IMG_R = "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=90";

export function AtelierStory() {
  return (
    <section className="bg-off-white py-[100px] md:py-[120px]">
      <div className="mx-auto max-w-3xl px-6 text-center md:px-8">
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.25em] text-olive">The Atelier</p>
        <h2 className="mt-4 font-display text-[32px] font-normal italic leading-[1.05] text-black md:text-[52px]">
          Built in Lagos.
          <br />
          Worn Worldwide.
        </h2>
        <p className="mx-auto mt-6 max-w-xl font-body text-[16px] font-light leading-[1.85] text-dark-grey">
          Prudent Gabriel began as a single vision in Lagos, Nigeria. Today, our pieces are worn at weddings, galas, and
          boardrooms across four continents. Every creation carries the mark of our atelier — made by hand, made to last.
        </p>
        <Link
          href="/our-story"
          className="mt-10 inline-block border-b border-black pb-0.5 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-black transition-colors hover:border-olive hover:text-olive"
        >
          Our Story →
        </Link>
      </div>

      <div className="mx-auto mt-16 grid max-w-[1400px] grid-cols-1 gap-0.5 px-0 md:grid-cols-[3fr_2fr] md:px-8">
        <div className="group relative h-[280px] overflow-hidden md:h-[400px]">
          <Image
            src={IMG_L}
            alt="Atelier craft"
            fill
            className="object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.02]"
            sizes="(max-width:768px) 100vw, 60vw"
          />
        </div>
        <div className="group relative h-[280px] overflow-hidden md:h-[400px]">
          <Image
            src={IMG_R}
            alt="Editorial"
            fill
            className="object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.02]"
            sizes="(max-width:768px) 100vw, 40vw"
          />
        </div>
      </div>
    </section>
  );
}
