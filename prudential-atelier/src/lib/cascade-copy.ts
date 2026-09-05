export const CASCADE_CONFIRMATION = "DELETE";

export type CascadeDialogCopy = {
  title: string;
  heading: string;
  lines: string[];
  loud: boolean;
  blocked?: boolean;
};

export type CascadeActorSnap = {
  userId: string;
  email: string | null;
  role: string;
  ip: string | null;
};

export type CascadePaymentSnap = {
  reference: string;
  method: string;
  status: string;
  amountNGN: number;
  at: string;
  orderNumber: string | null;
};

export function formatReceivedNGN(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

export function joinNamedList(names: string[], cap = 8): string {
  if (names.length <= cap) return names.join(", ");
  return `${names.slice(0, cap).join(", ")}, and ${names.length - cap} more`;
}
