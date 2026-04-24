"use client";

import { Button } from "@/components/ui/Button";

export function PFABanner() {
  return (
    <section className="border-t border-gold/20 bg-charcoal py-5">
      <div className="mx-auto flex max-w-site flex-col items-center gap-4 px-4 text-center md:flex-row md:justify-between md:text-left">
        <p className="font-display text-xl italic text-gold">Aspire to Create</p>
        <p className="max-w-xl font-body text-sm text-ivory md:text-left">
          Learn from the master. Prudential Fashion Academy has trained over 5,000 designers.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => window.open("https://pfacademy.ng", "_blank")}
        >
          Explore PFA Academy →
        </Button>
      </div>
    </section>
  );
}
