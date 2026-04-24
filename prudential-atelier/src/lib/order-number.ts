/** PA-YY-NNNNN (year last 2 digits) */
export function generateOrderNumber(): string {
  const yy = String(new Date().getFullYear()).slice(-2);
  const n = Math.floor(Math.random() * 99999) + 1;
  return `PA-${yy}-${String(n).padStart(5, "0")}`;
}

/** BQ-YYYY-NNNNN */
export function generateBespokeNumber(): string {
  const y = String(new Date().getFullYear());
  const n = Math.floor(Math.random() * 99999) + 1;
  return `BQ-${y}-${String(n).padStart(5, "0")}`;
}
