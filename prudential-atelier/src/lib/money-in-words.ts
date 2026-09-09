import { roundToKobo } from "@/lib/money";
import type { InvoiceCurrency } from "@/types/invoice";

const ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function underThousand(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (rest >= 20) {
    const ten = Math.floor(rest / 10);
    const one = rest % 10;
    parts.push(one ? `${TENS[ten]}-${ONES[one]}` : TENS[ten]);
  } else if (rest > 0) {
    parts.push(ONES[rest]);
  }
  return parts.join(" ");
}

function integerToWords(n: number): string {
  if (n === 0) return "zero";
  const scales = ["", "thousand", "million", "billion", "trillion"];
  const parts: string[] = [];
  let remaining = n;
  let scale = 0;
  while (remaining > 0 && scale < scales.length) {
    const chunk = remaining % 1000;
    if (chunk) {
      const words = underThousand(chunk);
      parts.unshift(scales[scale] ? `${words} ${scales[scale]}` : words);
    }
    remaining = Math.floor(remaining / 1000);
    scale += 1;
  }
  return parts.join(" ");
}

function majorMinor(currency: InvoiceCurrency): { major: string; minor: string } {
  switch (currency) {
    case "USD":
      return { major: "dollars", minor: "cents" };
    case "GBP":
      return { major: "pounds", minor: "pence" };
    case "EUR":
      return { major: "euros", minor: "cents" };
    default:
      return { major: "naira", minor: "kobo" };
  }
}

/** "ten million eight hundred thousand naira only" */
export function amountInWords(amount: number, currency: InvoiceCurrency): string {
  const rounded = roundToKobo(amount);
  const whole = Math.floor(Math.abs(rounded));
  const frac = Math.round((Math.abs(rounded) - whole) * 100);
  const { major, minor } = majorMinor(currency);
  const majorWords = integerToWords(whole);
  if (frac > 0) {
    return `${majorWords} ${major} and ${integerToWords(frac)} ${minor} only`;
  }
  return `${majorWords} ${major} only`;
}

export function payInstructionLine(amount: number, currency: InvoiceCurrency, formatted: string): string {
  return `Kindly pay ${amountInWords(amount, currency)} (${formatted}) now.`;
}
