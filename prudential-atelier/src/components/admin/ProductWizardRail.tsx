"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRODUCT_WIZARD_STEPS,
  wizardStepComplete,
  wizardStepHint,
  type PublishSnapshot,
} from "@/lib/product-wizard";

type Props = {
  step: number;
  onStep: (index: number) => void;
  snapshot: PublishSnapshot;
};

export function ProductWizardRail({ step, onStep, snapshot }: Props) {
  return (
    <nav aria-label="Product steps" className="border-b border-sand pb-6">
      <ol className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {PRODUCT_WIZARD_STEPS.map((s, i) => {
          const done = wizardStepComplete(i, snapshot);
          const current = step === i;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onStep(i)}
                className={cn(
                  "flex min-h-[44px] w-full items-start gap-3 rounded-sm border px-3 py-3 text-left transition-colors",
                  current ? "border-choc bg-cream" : "border-sand bg-cream/40 hover:border-choc/40",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs",
                    done
                      ? "border-choc bg-choc text-cream"
                      : current
                        ? "border-choc text-choc"
                        : "border-sand text-choc/50",
                  )}
                  aria-hidden
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-base text-choc">{s.label}</span>
                  <span className="mt-0.5 block font-body text-xs text-choc/60">{wizardStepHint(i, snapshot)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 font-body text-sm text-choc/70">
        A draft only needs a name. To publish: a name, a price, one photo, and one size.
      </p>
    </nav>
  );
}
