const TEMP_WORDS = [
  "AMBER",
  "CORAL",
  "IVORY",
  "VELVET",
  "SILK",
  "LINEN",
  "SATIN",
  "PEARL",
  "ROUGE",
  "EBONY",
];

export function generateTempPassword(): string {
  const word = TEMP_WORDS[Math.floor(Math.random() * TEMP_WORDS.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${word}-${num}`;
}
