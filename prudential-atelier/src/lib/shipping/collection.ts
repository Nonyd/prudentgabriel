import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCollectionCode(): string {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `PG-${code}`;
}

export function normalizeCollectionCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}
