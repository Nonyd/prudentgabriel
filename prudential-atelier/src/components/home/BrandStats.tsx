"use client";

import CountUp from "react-countup";
import { useInView } from "react-intersection-observer";

export function BrandStats() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 });
  return (
    <section ref={ref} className="bg-charcoal py-20">
      <div className="mx-auto grid max-w-site grid-cols-2 gap-8 px-4 md:grid-cols-4 md:gap-0">
        <div className="text-center">
          <p className="font-display text-4xl italic text-gold md:text-5xl">
            {inView ? <CountUp end={5000} duration={2} separator="," suffix="+" /> : "0"}
          </p>
          <p className="mt-2 font-label text-[12px] uppercase tracking-[0.15em] text-ivory/60">Designers Trained</p>
        </div>
        <div className="text-center md:border-l md:border-gold/20">
          <p className="font-display text-4xl italic text-gold md:text-5xl">
            {inView ? <CountUp start={2010} end={2019} duration={1.5} useEasing={false} /> : "0"}
          </p>
          <p className="mt-2 font-label text-[12px] uppercase tracking-[0.15em] text-ivory/60">Est. in Lagos</p>
        </div>
        <div className="text-center md:border-l md:border-gold/20">
          <p className="font-display text-4xl italic text-gold md:text-5xl">
            {inView ? <CountUp end={85} duration={2} suffix="+" /> : "0"}
          </p>
          <p className="mt-2 font-label text-[12px] uppercase tracking-[0.15em] text-ivory/60">Team Members</p>
        </div>
        <div className="text-center md:border-l md:border-gold/20">
          <p className="font-display text-4xl italic text-gold md:text-5xl">
            {inView ? <CountUp end={4} duration={2} /> : "0"}
          </p>
          <p className="mt-2 font-label text-[12px] uppercase tracking-[0.15em] text-ivory/60">Continents Served</p>
        </div>
      </div>
    </section>
  );
}
