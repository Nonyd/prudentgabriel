"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useCartStore } from "@/store/cartStore";
import { useBagActions } from "@/hooks/useBagActions";
import { formatPrice } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";
import { cartLineAmountInCurrency } from "@/lib/pricing";

export default function CartPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const totalItems = useCartStore((s) => s.totalItems);
  const { changeQty, removeFromBag } = useBagActions();
  const currency = useCurrencyStore((s) => s.currency);
  const rates = useCurrencyStore((s) => s.rates);

  const fmtLine = (item: (typeof items)[number]) =>
    formatPrice(cartLineAmountInCurrency(item, currency, rates), currency);
  const subtotalShopper = items.reduce((s, i) => s + cartLineAmountInCurrency(i, currency, rates), 0);

  return (
    <div className="mx-auto max-w-site px-4 py-10 lg:px-10">
      <h1 className="font-display text-3xl text-charcoal">Your bag ({totalItems})</h1>

      {items.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-display text-lg italic text-charcoal">Your bag is empty</p>
          <Button type="button" className="mt-8" onClick={() => router.push("/rtw")}>
            Shop ready-to-wear
          </Button>
        </div>
      ) : (
        <div className="mt-10 grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <ul className="min-w-0 space-y-6">
            {items.map((item) => (
              <li key={item.id} className="flex gap-4 border-b border-border pb-6">
                <div className="relative h-24 w-20 shrink-0 overflow-hidden bg-ivory-dark">
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" sizes="80px" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base text-charcoal">{item.productName}</p>
                  <p className="mt-1 font-body text-[11px] uppercase tracking-wider text-dark-grey">
                    {item.sizeMode === "CUSTOM" ? "Made to measure" : item.size}
                    {item.color ? ` · ${item.color}` : ""}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={item.quantity <= 1}
                      className="flex h-8 w-8 items-center justify-center border border-border text-sm disabled:opacity-40"
                      aria-label={`Decrease quantity of ${item.productName}`}
                      onClick={() => void changeQty(item.id, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center border border-border text-sm"
                      aria-label={`Increase quantity of ${item.productName}`}
                      onClick={() => void changeQty(item.id, item.quantity + 1)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="ml-4 font-body text-[11px] uppercase text-dark-grey underline"
                      aria-label={`Remove ${item.productName} from bag`}
                      onClick={() => void removeFromBag(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <p className="shrink-0 font-medium text-charcoal">{fmtLine(item)}</p>
              </li>
            ))}
          </ul>

          <aside className="h-fit min-w-0 border border-border bg-off-white p-6">
            <div className="flex items-baseline justify-between">
              <span className="font-label text-xs uppercase text-charcoal-mid">Subtotal</span>
              <span className="font-display text-xl text-charcoal">{formatPrice(subtotalShopper, currency)}</span>
            </div>
            <p className="mt-2 text-xs text-charcoal-light">Shipping calculated at checkout</p>
            <Button type="button" className="mt-6 w-full" size="lg" onClick={() => router.push("/checkout")}>
              Checkout
            </Button>
            <Link
              href="/rtw"
              className="mt-4 block text-center font-body text-[11px] uppercase tracking-wider text-choc hover:underline"
            >
              Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
