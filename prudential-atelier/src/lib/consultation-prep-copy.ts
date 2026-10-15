/**
 * What a client reads once the consultation is paid: in the email, on the
 * success page after an online payment, and on the pending page after a bank
 * transfer receipt. One source so the three never drift apart. Physical and
 * virtual consultations each have their own letter.
 */

export type ConsultationPrepPoint = { title: string; body: string };

export type ConsultationLetter = {
  intro: string[];
  /** The line that introduces the numbered notes. */
  lead: string;
  closing: string[];
};

const PHYSICAL: ConsultationLetter = {
  intro: [
    "Thank you for your consultation payment and for choosing Prudent Gabriel.",
    "We are already excited about the beautiful journey ahead and cannot wait to begin bringing your dream dress to life!",
  ],
  lead: "To help you prepare for your physical consultation, please take note of the following:",
  closing: [
    "Our goal is to make this experience intentional, collaborative, and enjoyable, ensuring that we understand your vision and guide you confidently through the process.",
    "We believe creating your dream dress should be just as beautiful as wearing it, and we look forward to making this journey a memorable one.",
    "Thank you once again for trusting Prudent Gabriel Atelier. We cannot wait to meet you!",
  ],
};

const VIRTUAL: ConsultationLetter = {
  intro: [
    "Thank you for your payment. We are pleased to confirm your virtual consultation with Prudent Gabriel Atelier.",
    "We are excited to begin this journey with you and look forward to working together to bring your dream dress to life.",
  ],
  lead: "Here’s what you need to know before your consultation:",
  closing: [
    "We believe creating your dream dress should be an intentional and collaborative experience. Throughout this journey, we are committed to clear communication, transparency, and thoughtful attention to every detail.",
    "Thank you for trusting us with something so special. We cannot wait to bring your vision to life!",
  ],
};

export function consultationLetter(isVirtual: boolean): ConsultationLetter {
  return isVirtual ? VIRTUAL : PHYSICAL;
}

/** Bank transfer: the receipt is in, the payment is not confirmed yet. */
export const CONSULTATION_RECEIPT_INTRO = [
  "Thank you for sending your proof of payment and for choosing Prudent Gabriel.",
  "We will confirm your payment shortly, and we are already excited about the beautiful journey ahead. We cannot wait to begin bringing your dream dress to life!",
];

export const CONSULTATION_SIGN_OFF = { line: "With love,", team: "The Prudent Gabriel Atelier Team" };

function durationPhrase(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 1 ? "1 hour" : h > 1 ? `${h} hours` : "";
  const mins = m ? `${m} minutes` : "";
  return [hours, mins].filter(Boolean).join(" and ") || "about an hour";
}

export function consultationPrepPoints(opts: { isVirtual: boolean; durationMinutes: number }): ConsultationPrepPoint[] {
  const length = durationPhrase(opts.durationMinutes);
  if (opts.isVirtual) {
    return [
      {
        title: "Virtual Meeting Platform",
        body: "Your consultation will take place via Zoom or Google Meet. You are welcome to have your stylist, wedding planner, or any other important person join the call to offer guidance, share ideas, and contribute to the design discussion.",
      },
      {
        title: "Consultation Duration",
        body: `Please set aside ${length} for your consultation. This will give us sufficient time to understand your vision, discuss your preferences, explore design possibilities, and establish the creative direction for your dress.`,
      },
      {
        title: "Pencil Sketch Presentation",
        body: "During the consultation, our illustrator will develop a pencil sketch to help communicate and establish the direction of your proposed design.",
      },
      {
        title: "Measurements (Optional)",
        body: "If you would like your measurements taken immediately after the consultation, kindly have a measuring tape ready and arrange for one person to assist you. Our team will guide you through the process.",
      },
    ];
  }
  return [
    {
      title: "Your Stylist or Planner",
      body: "You are welcome to attend your consultation with your stylist or wedding planner. We understand the importance of having your trusted team involved, and we are happy to collaborate with them to ensure a smooth and seamless experience.",
    },
    {
      title: "Measurements and Preferred Heel Height",
      body: "Your measurements will be taken during the consultation. Kindly come along with your preferred heels, or a shoe with the heel height you intend to wear with your dress. This will help us establish your desired dress length accurately.",
    },
    {
      title: "Consultation Duration",
      body: `Your consultation will last approximately ${length}, allowing us sufficient time to understand your vision, discuss the details, and explore the creative direction for your dress.`,
    },
    {
      title: "Our Creative Team and Sketch Presentation",
      body: "Our creative team will be on hand to document the important details of your vision, preferences, and design requirements. Our illustrator will also be present, and we will present you with a pencil sketch of your proposed design during the consultation.",
    },
  ];
}
