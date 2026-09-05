import {
  CASCADE_CONFIRMATION,
  formatReceivedNGN,
  joinNamedList,
  type CascadeActorSnap,
  type CascadeDialogCopy,
  type CascadePaymentSnap,
} from "@/lib/cascade-copy";

export { formatReceivedNGN, CASCADE_CONFIRMATION as PRODUCT_CASCADE_CONFIRMATION };

export const PRODUCT_CASCADE_RECORD_TYPE = "product-cascade-delete";
export const PRODUCT_CASCADE_MODULE = "shop.products";
export const MAX_PRODUCT_CASCADE = 100;

export type { CascadeDialogCopy, CascadePaymentSnap };

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

export type CascadeSiblingPiece = {
  id: string;
  name: string;
};

export type ProductCascadeSnapshot = {
  kind: typeof PRODUCT_CASCADE_RECORD_TYPE;
  products: CascadeProductSnap[];
  orders: CascadeOrderSnap[];
  payments: CascadePaymentSnap[];
  siblingPieces: CascadeSiblingPiece[];
  customerEmails: string[];
  receivedNGN: number;
  actor: CascadeActorSnap;
};

export type ProductCascadePreview = {
  loud: boolean;
  productCount: number;
  productsWithOrders: number;
  products: CascadeProductSnap[];
  orders: CascadeOrderSnap[];
  payments: CascadePaymentSnap[];
  siblingPieces: CascadeSiblingPiece[];
  customerEmails: string[];
  receivedNGN: number;
  mediaUrls: string[];
};

export function cascadeDialogCopy(preview: ProductCascadePreview): CascadeDialogCopy {
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
  const lines = [
    `${ordered} ${ordered === 1 ? "has" : "have"} been ordered. Deleting them also removes:`,
    `· ${preview.orders.length} ${orderWord} — ${moneyBit}`,
    `· ${history}`,
  ];
  if (preview.siblingPieces.length > 0) {
    const names = joinNamedList(preview.siblingPieces.map((p) => p.name));
    const s = preview.siblingPieces.length;
    lines.push(
      s === 1
        ? `· 1 other piece loses its sale record (${names})`
        : `· ${s} other pieces lose their sale record (${names})`,
    );
  }
  lines.push("This cannot be undone.");
  return {
    title: "Delete ordered products",
    heading,
    lines,
    loud: true,
  };
}
