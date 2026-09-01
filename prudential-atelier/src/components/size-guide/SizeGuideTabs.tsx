"use client";

import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import type { MeasureStep, SizeGuideKidsRow, SizeGuideWomenRow } from "@/lib/page-content-defaults";

function WomenTable({ rows }: { rows: SizeGuideWomenRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left" style={{ border: "0.5px solid var(--sand)" }}>
        <thead>
          <tr style={{ backgroundColor: "var(--choc)", color: "var(--cream)" }}>
            {["UK SIZE", "BUST", "WAIST", "HIPS", "LENGTH"].map((h) => (
              <th
                key={h}
                className="px-4 py-3"
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.size}
              className="transition-colors hover:bg-[rgba(152,117,91,0.08)]"
              style={{ backgroundColor: i % 2 === 0 ? "var(--ivory)" : "white" }}
            >
              <td
                className="px-4 py-3"
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--choc)",
                }}
              >
                {row.size}
              </td>
              {[row.bust, row.waist, row.hips, row.length].map((v) => (
                <td
                  key={v}
                  className="px-4 py-3"
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: "13px",
                    color: "var(--text-mid)",
                  }}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KidsTable({ rows }: { rows: SizeGuideKidsRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-left" style={{ border: "0.5px solid var(--sand)" }}>
        <thead>
          <tr style={{ backgroundColor: "var(--choc)", color: "var(--cream)" }}>
            {["AGE", "HEIGHT (cm)", "CHEST (cm)", "WAIST (cm)"].map((h) => (
              <th
                key={h}
                className="px-4 py-3"
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.age}
              className="transition-colors hover:bg-[rgba(152,117,91,0.08)]"
              style={{ backgroundColor: i % 2 === 0 ? "var(--ivory)" : "white" }}
            >
              {[row.age, row.height, row.chest, row.waist].map((v) => (
                <td
                  key={v}
                  className="px-4 py-3"
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: "13px",
                    color: i === 0 && v === row.age ? "var(--choc)" : "var(--text-mid)",
                    fontWeight: v === row.age ? 600 : 400,
                  }}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type SizeGuideTabsProps = {
  women: SizeGuideWomenRow[];
  kids: SizeGuideKidsRow[];
  bridalIntro: string;
  bridalNotes: string;
  sizeTip: string;
  measureSteps: MeasureStep[];
};

export function SizeGuideTabs({ women, kids, bridalIntro, bridalNotes, sizeTip, measureSteps }: SizeGuideTabsProps) {
  const tabTriggerClass =
    "border-b-2 border-transparent px-4 py-3 uppercase transition-colors data-[state=active]:border-choc data-[state=active]:text-choc";

  return (
    <Tabs.Root defaultValue="women">
      <Tabs.List className="mb-10 flex flex-wrap gap-1 border-b border-sand">
        {[
          { value: "women", label: "Women" },
          { value: "bridal", label: "Bridal" },
          { value: "kids", label: "Kids" },
          { value: "measure", label: "How to Measure" },
        ].map((tab) => (
          <Tabs.Trigger
            key={tab.value}
            value={tab.value}
            className={tabTriggerClass}
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.14em",
              color: "var(--text-light)",
            }}
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <Tabs.Content value="women" className="space-y-6">
        <WomenTable rows={women} />
        <p
          className="rounded-md p-4 italic"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "var(--text-light)",
            backgroundColor: "rgba(152,117,91,0.06)",
          }}
        >
          💡 {sizeTip}
        </p>
      </Tabs.Content>

      <Tabs.Content value="bridal" className="space-y-8">
        <p
          className="mx-auto max-w-xl text-center italic"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "20px",
            color: "var(--choc)",
            lineHeight: 1.5,
          }}
        >
          &ldquo;{bridalIntro}&rdquo;
        </p>
        <WomenTable rows={women} />
        <div
          className="whitespace-pre-line rounded-md p-6"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "14px",
            color: "var(--text-mid)",
            lineHeight: 1.85,
            backgroundColor: "rgba(152,117,91,0.06)",
          }}
        >
          {bridalNotes}
        </div>
      </Tabs.Content>

      <Tabs.Content value="kids">
        <KidsTable rows={kids} />
      </Tabs.Content>

      <Tabs.Content value="measure" className="space-y-12">
        <div className="grid gap-10 md:grid-cols-2">
          {measureSteps.map((step, i) => (
            <div key={step.title} className="relative pl-2">
              <p
                className="leading-none"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "48px",
                  color: "var(--sand)",
                }}
              >
                {String(i + 1).padStart(2, "0")}.
              </p>
              <p
                className="mt-3 uppercase"
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: "13px",
                  letterSpacing: "0.12em",
                  color: "var(--lightbr)",
                }}
              >
                {step.title}
              </p>
              <p
                className="mt-2 max-w-sm"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "14px",
                  color: "var(--text-mid)",
                  lineHeight: 1.75,
                }}
              >
                {step.description}
              </p>
              <div
                className="mt-4 flex h-32 items-center justify-center rounded-md border border-dashed border-sand bg-ivory/80 text-xs uppercase tracking-widest text-text-light"
                aria-hidden
              >
                Illustration
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-sand pt-10 text-center">
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "15px",
              color: "var(--text-mid)",
              lineHeight: 1.8,
            }}
          >
            Not sure about your measurements?
            <br />
            Book a consultation and our team will take your measurements professionally.
          </p>
          <Link
            href="/consultation"
            className="mt-6 inline-flex items-center justify-center rounded-[3px] px-8 py-3 uppercase transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--choc)",
              color: "var(--cream)",
              fontFamily: "var(--font-ui)",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.18em",
            }}
          >
            Book a Consultation →
          </Link>
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
}
