/** Shared email tokens. Inline only. Most clients ignore webfonts. */

export const EMAIL_CHOC = "#442913";
export const EMAIL_GOLD = "#C9A84C";
export const EMAIL_CREAM = "#F7F2EC";
export const EMAIL_SAND = "#E2D1C2";
export const EMAIL_INK = "#2C241C";
export const EMAIL_MUTED = "#6B5E52";
export const EMAIL_FOOTER_BG = "#1A0F08";
export const EMAIL_CARD = "#FFFdf8";

/** Display: webfont first, then a real serif so fallback still looks considered. */
export const FONT_DISPLAY =
  "'Cormorant Garamond', Cormorant, Georgia, 'Times New Roman', Times, serif";
/** Body: Lora if it loads, Georgia if it does not. */
export const FONT_BODY = "Lora, Georgia, 'Times New Roman', Times, serif";
/** UI / buttons: Jost if it loads, Helvetica/Arial if it does not. */
export const FONT_UI = "Jost, 'Helvetica Neue', Helvetica, Arial, sans-serif";

export type EmailFamily = "transactional" | "relationship" | "marketing";

export const EMAIL_WIDTH = 600;

export function familyPageBg(family: EmailFamily): string {
  if (family === "marketing") return EMAIL_SAND;
  return EMAIL_CREAM;
}

export function familyCardBg(family: EmailFamily): string {
  if (family === "marketing") return EMAIL_CREAM;
  return "#FFFdf9";
}

export function familyBodyPad(family: EmailFamily): string {
  if (family === "transactional") return "28px 36px 36px";
  if (family === "relationship") return "36px 40px 40px";
  return "24px 32px 36px";
}
