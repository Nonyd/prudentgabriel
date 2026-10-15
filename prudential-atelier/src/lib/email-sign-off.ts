import type { EmailBrand } from "@/lib/email-branding";

export type EmailSignOff = { line: string; team: string };

/** The closing every client email ends with, by brand. No React here: server pages import it. */
export function brandSignOff(brand: EmailBrand): EmailSignOff {
  return {
    line: "With love,",
    team: brand === "atelier" ? "The Prudent Gabriel Atelier Team" : "The Prudent Gabriel Team",
  };
}
