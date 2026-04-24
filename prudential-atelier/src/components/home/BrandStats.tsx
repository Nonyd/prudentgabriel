"use client";

import CountUp from "react-countup";
import { useInView } from "react-intersection-observer";

export function BrandStats() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 });
  return (
    <section ref={ref} className="bg-olive py-16 md:py-20">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-10 px-6 md:grid-cols-4 md:gap-8 md:px-8">
        <div className="text-center">
          <p className="font-display text-[40px] font-normal italic leading-none text-white md:text-[56px]">
            {inView ? <CountUp end={5000} duration={2} separator="," suffix="+" /> : "0"}
          </p>
          <p className="mt-3 font-body text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">Designers Trained</p>
        </div>
        <div className="text-center">
          <p className="font-display text-[40px] font-normal italic leading-none text-white md:text-[56px]">
            {inView ? <CountUp start={2010} end={2019} duration={1.5} useEasing={false} /> : "0"}
          </p>
          <p className="mt-3 font-body text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">Est. in Lagos</p>
        </div>
        <div className="text-center">
          <p className="font-display text-[40px] font-normal italic leading-none text-white md:text-[56px]">
            {inView ? <CountUp end={85} duration={2} suffix="+" /> : "0"}
          </p>
          <p className="mt-3 font-body text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">Team Members</p>
        </div>
        <div className="text-center">
          <p className="font-display text-[40px] font-normal italic leading-none text-white md:text-[56px]">
            {inView ? <CountUp end={4} duration={2} /> : "0"}
          </p>
          <p className="mt-3 font-body text-[10px] font-medium uppercase tracking-[0.2em] text-white/50">Continents Served</p>
        </div>
      </div>
    </section>
  );
}
