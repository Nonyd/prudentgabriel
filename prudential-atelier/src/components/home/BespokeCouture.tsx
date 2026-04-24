"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";

const IMG = "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&q=90";

const STEPS = [
  {
    n: "01",
    title: "Consultation",
    desc: "A private session with our design team or Mrs. Gabriel-Okopi.",
  },
  {
    n: "02",
    title: "Creation",
    desc: "Your piece is built by hand in our Lagos atelier.",
  },
  {
    n: "03",
    title: "Delivery",
    desc: "Couriered to you, anywhere in the world.",
  },
];

export function BespokeCouture() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["5%", "-5%"]);

  return (
    <section ref={ref} className="overflow-hidden bg-black py-[100px] md:py-[120px]">
      <div className="mx-auto grid max-w-[1400px] items-stretch gap-0 px-0 md:grid-cols-2 md:px-8">
        <div className="relative min-h-[70vw] md:min-h-0 md:aspect-[4/5]">
          <motion.div style={{ y }} className="absolute inset-x-0 top-[-5%] h-[110%] w-full">
            <Image src={IMG} alt="Bespoke couture" fill className="object-cover object-top" sizes="(max-width:768px) 100vw, 50vw" />
          </motion.div>
        </div>

        <div className="flex flex-col justify-center px-6 py-12 md:py-0 md:pl-16 md:pr-20 lg:pl-20">
          <p className="font-body text-[10px] font-medium uppercase tracking-[0.25em] text-olive">Bespoke Couture</p>
          <h2 className="mt-4 font-display text-[32px] font-normal italic leading-none text-white md:text-[56px]">
            One Piece.
            <br />
            One Story.
            <br />
            Yours.
          </h2>
          <p className="mt-6 max-w-md font-body text-[15px] font-light leading-[1.8] text-white/65">
            From the first sketch to the final stitch — every bespoke piece is conceived, designed, and hand-crafted exclusively
            for you. No two are alike.
          </p>

          <ul className="mt-10 flex flex-col gap-6">
            {STEPS.map((s) => (
              <li key={s.n} className="flex items-start gap-4">
                <span className="w-10 shrink-0 font-display text-[48px] font-normal italic leading-none text-olive/40">
                  {s.n}
                </span>
                <div>
                  <p className="font-body text-[12px] font-medium uppercase tracking-[0.12em] text-white">{s.title}</p>
                  <p className="mt-1 font-body text-[13px] font-light text-white/50">{s.desc}</p>
                </div>
              </li>
            ))}
          </ul>

          <Link
            href="/bespoke"
            className="mt-12 inline-flex border border-white px-10 py-4 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white transition-colors duration-200 hover:bg-white hover:text-black"
          >
            Begin Your Bespoke Journey
          </Link>
        </div>
      </div>
    </section>
  );
}
