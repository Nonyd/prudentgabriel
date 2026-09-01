"use client";

import { Logo } from "@/components/ui/Logo";

export function AuthBrandPanel({
  title,
  kicker = "Prudential Atelier · Lagos",
}: {
  title: string;
  kicker?: string;
}) {
  return (
    <div className="relative hidden flex-col justify-between bg-choc px-12 py-14 lg:flex">
      <Logo variant="white" size="lg" themeAdaptive={false} />
      <div className="max-w-sm">
        <p className="font-serif text-[2rem] font-normal leading-tight text-cream">{title}</p>
        <p className="mt-5 font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-sand">{kicker}</p>
      </div>
    </div>
  );
}
