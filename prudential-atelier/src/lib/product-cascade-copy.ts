export const PRODUCT_CASCADE_RECORD_TYPE = "product-cascade-delete";
export const PRODUCT_CASCADE_MODULE = "shop.products";
export const PRODUCT_CASCADE_CONFIRMATION = "DELETE";
export const MAX_PRODUCT_CASCADE = 100;

export type CascadePaymentSnap = {
  reference: string;
  method: string;
  status: string;
  amountNGN: number;
  at: string;
  orderNumber: string | null;
};

export type CascadeOrderSnap = {
  id: string;
  orderNumber: string;
  date: string;
  totalNGN: number;
  receivedNGN: number;
  customerEmail: string | null;
};

export type CascadeProductSnap = {
  id: string;
  name: string;
  slug: string;
  skus: string[];
};

export type ProductCascadeSnapshot = {
  kind: typeof PRODUCT_CASCADE_RECORD_TYPE;
  products: CascadeProductSnap[];
  orders: CascadeOrderSnap[];
  payments: CascadePaymentSnap[];
  customerEmails: string[];
  receivedNGN: number;
  actor: { userId: string; email: string | null; role: string; ip: string | null };
};

export type ProductCascadePreview = {
  loud: boolean;
  productCount: number;
  productsWithOrders: number;
  products: CascadeProductSnap[];
  orders: CascadeOrderSnap[];
  payments: CascadePaymentSnap[];
  customerEmails: string[];
  receivedNGN: number;
  mediaUrls: string[];
};

export function formatReceivedNGN(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

export function cascadeDialogCopy(preview: ProductCascadePreview): {
  title: string;
  heading: string;
  lines: string[];
  loud: boolean;
} {
  const n = preview.productCount;
  const heading = `${n} ${n === 1 ? "piece" : "pieces"} will be deleted.`;
  if (!preview.loud) {
    return {
      title: n === 1 ? `Delete ${preview.products[0]?.name ?? "product"}` : "Delete products",
      heading,
      lines: ["None have been ordered.", "This cannot be undone."],
      loud: false,
    };
  }
  const ordered = preview.productsWithOrders;
  const orderWord = preview.orders.length === 1 ? "order" : "orders";
  const customers = preview.customerEmails.length;
  const moneyBit =
    preview.receivedNGN > 0 && customers > 0
      ? `${formatReceivedNGN(preview.receivedNGN)} received across ${customers} ${customers === 1 ? "customer" : "customers"}`
      : `${formatReceivedNGN(preview.receivedNGN)} received`;
  const history =
    customers === 1 ? "1 customer's order history" : `${customers} customers' order history`;
  return {
    title: "Delete ordered products",
    heading,
    lines: [
      `${ordered} ${ordered === 1 ? "has" : "have"} been ordered. Deleting them also removes:`,
      `· ${preview.orders.length} ${orderWord} — ${moneyBit}`,
      `· ${history}`,
      "This cannot be undone.",
    ],
    loud: true,
  };
}
