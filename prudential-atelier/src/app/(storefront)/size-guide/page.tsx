import { SizeGuideTabs } from "@/components/size-guide/SizeGuideTabs";
import { cmsGet, cmsJson, getCMSContent } from "@/lib/cms";
import {
  DEFAULT_BRIDAL_INTRO,
  DEFAULT_BRIDAL_NOTES,
  DEFAULT_KIDS_SIZE_CHART,
  DEFAULT_MEASURE_STEPS,
  DEFAULT_SIZE_TIP,
  DEFAULT_WOMEN_SIZE_CHART,
} from "@/lib/page-content-defaults";

export const revalidate = 300;

const SIZE_GUIDE_KEYS = [
  "size_guide_women",
  "size_guide_kids",
  "size_guide_bridal_intro",
  "size_guide_bridal_notes",
  "size_guide_size_tip",
  "size_guide_measure_steps",
] as const;

export default async function SizeGuidePage() {
  let cms: Record<string, string> = {};
  try {
    cms = await getCMSContent([...SIZE_GUIDE_KEYS]);
  } catch {
    /* defaults */
  }

  const women = cmsJson(cms, "size_guide_women", DEFAULT_WOMEN_SIZE_CHART);
  const kids = cmsJson(cms, "size_guide_kids", DEFAULT_KIDS_SIZE_CHART);
  const bridalIntro = cmsGet(cms, "size_guide_bridal_intro", DEFAULT_BRIDAL_INTRO);
  const bridalNotes = cmsGet(cms, "size_guide_bridal_notes", DEFAULT_BRIDAL_NOTES);
  const sizeTip = cmsGet(cms, "size_guide_size_tip", DEFAULT_SIZE_TIP);
  const measureSteps = cmsJson(cms, "size_guide_measure_steps", DEFAULT_MEASURE_STEPS);

  return (
    <div className="bg-ivory">
      <header className="border-b border-sand/60 px-6 py-16 text-center lg:px-10 lg:py-20">
        <p
          className="uppercase"
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.2em",
            color: "var(--lightbr)",
          }}
        >
          Size Guide
        </p>
        <h1
          className="mt-3"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.25rem, 4.5vw, 52px)",
            fontWeight: 400,
            color: "var(--choc)",
          }}
        >
          Find your perfect fit
        </h1>
        <p
          className="mx-auto mt-4 max-w-lg"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "15px",
            color: "var(--text-mid)",
          }}
        >
          All measurements in centimetres unless stated.
        </p>
      </header>

      <div className="mx-auto max-w-site px-6 py-16 lg:px-10 lg:py-20">
        <SizeGuideTabs
          women={women}
          kids={kids}
          bridalIntro={bridalIntro}
          bridalNotes={bridalNotes}
          sizeTip={sizeTip}
          measureSteps={measureSteps}
        />
      </div>
    </div>
  );
}
