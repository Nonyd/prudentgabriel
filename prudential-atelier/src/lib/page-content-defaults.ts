export type SizeGuideWomenRow = {
  size: string;
  bust: string;
  waist: string;
  hips: string;
  length: string;
};

export type SizeGuideKidsRow = {
  age: string;
  height: string;
  chest: string;
  waist: string;
};

export type MeasureStep = {
  title: string;
  description: string;
};

export type AboutValue = {
  name: string;
  description: string;
};

export const DEFAULT_WOMEN_SIZE_CHART: SizeGuideWomenRow[] = [
  { size: "6", bust: "80", waist: "61", hips: "86", length: "100" },
  { size: "8", bust: "83", waist: "64", hips: "89", length: "101" },
  { size: "10", bust: "86", waist: "67", hips: "92", length: "102" },
  { size: "12", bust: "90", waist: "71", hips: "96", length: "103" },
  { size: "14", bust: "94", waist: "75", hips: "100", length: "104" },
  { size: "16", bust: "98", waist: "79", hips: "104", length: "105" },
  { size: "18", bust: "103", waist: "84", hips: "109", length: "106" },
  { size: "20", bust: "108", waist: "89", hips: "114", length: "107" },
  { size: "22", bust: "114", waist: "95", hips: "120", length: "108" },
];

export const DEFAULT_KIDS_SIZE_CHART: SizeGuideKidsRow[] = [
  { age: "2–4", height: "92–104", chest: "53–56", waist: "50–52" },
  { age: "4–6", height: "104–116", chest: "56–60", waist: "52–54" },
  { age: "6–8", height: "116–128", chest: "60–64", waist: "54–57" },
  { age: "8–10", height: "128–138", chest: "64–69", waist: "57–60" },
  { age: "10–12", height: "138–149", chest: "69–74", waist: "60–63" },
];

export const DEFAULT_MEASURE_STEPS: MeasureStep[] = [
  {
    title: "Bust",
    description: "Measure around the fullest part of your chest, keeping the tape parallel to the ground.",
  },
  {
    title: "Waist",
    description: "Measure around your natural waistline — the narrowest part of your torso.",
  },
  {
    title: "Hips",
    description:
      "Stand with feet together. Measure around the fullest part of your hips, about 20cm below your waist.",
  },
  {
    title: "Dress Length",
    description: "Measure from your shoulder down to where you want the hem to fall.",
  },
  {
    title: "Shoulder Width",
    description: "Measure from the edge of one shoulder to the other across your back.",
  },
];

export const DEFAULT_BRIDAL_NOTES = `BRIDAL SIZING NOTES

• Bridal gowns are structured differently from RTW pieces. We recommend ordering 1–2 sizes up for bridal.
• All bridal pieces include 2 scheduled fittings.
• Final alterations are completed in the last fitting before your event.
• We recommend beginning your bridal journey at least 4–6 months before your event date.`;

export const DEFAULT_ABOUT_VALUES: AboutValue[] = [
  {
    name: "Craftsmanship",
    description:
      "Every stitch is placed with intention. We hold ourselves to the highest standard of garment construction.",
  },
  {
    name: "Individuality",
    description: "No two women are the same. We design around your story, not the other way around.",
  },
  {
    name: "Excellence",
    description:
      "From the first consultation to the final delivery, excellence is not optional — it is expected.",
  },
  {
    name: "Heritage",
    description:
      "Proudly rooted in Lagos, we celebrate African fabric, technique, and identity in everything we create.",
  },
  {
    name: "Integrity",
    description: "We keep our promises. Delivery dates, quality standards, and commitments are sacred to us.",
  },
  {
    name: "Relationships",
    description: "Our clients are not transactions. They are relationships we nurture across years and milestones.",
  },
];

export const DEFAULT_BRIDAL_INTRO =
  "All Prudential Atelier bridal pieces are made-to-measure. We take your exact measurements during your consultation to ensure a perfect fit on your special day.";

export const DEFAULT_SIZE_TIP =
  "Between sizes? We recommend sizing up for a more comfortable fit, or booking a consultation for a made-to-measure piece.";
