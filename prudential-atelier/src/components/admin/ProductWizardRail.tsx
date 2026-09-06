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
    <nav aria-label="Product steps" className="glass-opaque px-3 py-3">
      <ol className="flex flex-wrap gap-2">
        {PRODUCT_WIZARD_STEPS.map((s, i) => {
          const done = wizardStepComplete(i, snapshot);
          const current = step === i;
          return (
            <li key={s.id} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onStep(i)}
                className={cn(
                  "flex min-h-[44px] w-full items-center gap-2 px-3 text-left",
                  current ? "bg-cream text-choc" : "border border-sand bg-transparent text-choc/70 hover:border-choc/40",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px]",
                    done
                      ? "border-choc bg-choc text-cream"
                      : current
                        ? "border-choc text-choc"
                        : "border-sand text-choc/50",
                  )}
                  aria-hidden
                >
                  {done ? <Check className="h-3 w-3" strokeWidth={2} /> : i + 1}
                </span>
                <span className="truncate font-sans text-[12px] font-medium">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 px-1 font-body text-xs text-choc/60">{wizardStepHint(step, snapshot)}</p>
    </nav>
  );
}
