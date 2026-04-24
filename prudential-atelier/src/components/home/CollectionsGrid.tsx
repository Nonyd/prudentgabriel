import Image from "next/image";
import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";

const CELLS = [
  {
    title: "Bridal",
    sub: "BRIDAL",
    href: "/shop?category=BRIDAL",
    img: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800",
    className: "md:col-start-1 md:row-span-2 md:row-start-1 min-h-[300px]",
  },
  {
    title: "Evening Wear",
    sub: "EVENING",
    href: "/shop?category=EVENING_WEAR",
    img: "https://images.unsplash.com/photo-1566174053879-435285eff2e8?w=800",
    className: "min-h-[220px]",
  },
  {
    title: "Formal",
    sub: "FORMAL",
    href: "/shop?category=FORMAL",
    img: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800",
    className: "min-h-[220px]",
  },
  {
    title: "Ready-to-Wear",
    sub: "RTW",
    href: "/shop?category=CASUAL",
    img: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800",
    className: "md:col-span-2 min-h-[260px]",
  },
];

export function CollectionsGrid() {
  return (
    <section className="py-section-mobile md:py-section">
      <div className="mx-auto max-w-site px-4 text-center">
        <SectionLabel>THE COLLECTIONS</SectionLabel>
        <h2 className="mt-4 font-display text-4xl text-charcoal md:text-5xl">Crafted for Every Chapter</h2>
      </div>
      <div className="mx-auto mt-16 grid max-w-site grid-cols-2 gap-3 px-4 md:grid-cols-3 md:gap-4">
        {CELLS.map((c) => (
          <Link
            key={c.title}
            href={c.href}
            className={`group relative overflow-hidden rounded-sm ${c.className}`}
          >
            <Image
              src={c.img}
              alt={c.title}
              fill
              priority
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width:768px) 50vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6 text-left text-ivory">
              <p className="font-label text-[13px] text-ivory/80">{c.sub}</p>
              <h3 className="font-display text-2xl md:text-[28px]">{c.title}</h3>
              <p className="mt-2 translate-y-4 font-body text-sm text-gold opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                Explore →
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
