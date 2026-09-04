"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCartStore } from "@/store/cartStore";
import { useBagActions } from "@/hooks/useBagActions";
import { formatPrice } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cartLineAmountInCurrency } from "@/lib/pricing";

export function CartDrawer() {
  const router = useRouter();
  const isOpen = useCartStore((s) => s.isOpen);
  const closeCart = useCartStore((s) => s.closeCart);
  const items = useCartStore((s) => s.items);
  const totalItems = useCartStore((s) => s.totalItems);
  const totalNGN = useCartStore((s) => s.totalNGN);
  const { changeQty, removeFromBag } = useBagActions();
  const currency = useCurrencyStore((s) => s.currency);
  const rates = useCurrencyStore((s) => s.rates);
  const panelRef = useRef<HTMLElement>(null);
  useFocusTrap(isOpen, panelRef);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closeCart]);

  const fmtLine = (item: (typeof items)[number]) =>
    formatPrice(cartLineAmountInCurrency(item, currency, rates), currency);
  const subtotalShopper = items.reduce((s, i) => s + cartLineAmountInCurrency(i, currency, rates), 0);
  const points = Math.floor(totalNGN / 100);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            aria-label="Close cart overlay"
            className="fixed inset-0 z-50 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
          />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Your bag"
            className="fixed bottom-0 right-0 top-0 z-50 flex h-full min-h-0 w-full max-w-[420px] flex-col border-l border-[var(--border)] bg-[var(--white)] shadow-xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <h2 className="font-body text-[12px] font-medium uppercase tracking-[0.12em] text-charcoal">
                Your Bag ({totalItems})
              </h2>
              <button
                type="button"
                onClick={closeCart}
                className="p-2 text-charcoal hover:bg-light-grey"
                aria-label="Close cart"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4"
              data-lenis-prevent
            >
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <svg
                    className="mb-4 h-16 w-16 text-choc/80"
                    viewBox="0 0 64 64"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M12 20h40l-4 32H16L12 20z" />
                    <path d="M20 20V14a12 12 0 0124 0v6" />
                  </svg>
                  <p className="font-display text-lg italic text-charcoal">Your bag is empty</p>
                  <Button
                    type="button"
                    className="mt-8"
                    onClick={() => {
                      closeCart();
                      router.push("/rtw");
                    }}
                  >
                    Shop ready-to-wear
                  </Button>
                </div>
              ) : (
                <ul className="space-y-6">
                  {items.map((item) => (
                    <li key={item.id} className="relative flex gap-3 border-b border-border pb-6">
                      <button
                        type="button"
                        onClick={() => void removeFromBag(item.id)}
                        className="absolute right-0 top-0 text-dark-grey hover:text-choc"
                        aria-label="Remove"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-sm bg-ivory-dark">
                        {item.imageUrl && (
                          <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" sizes="64px" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pr-6">
                        <p className="font-display text-sm text-charcoal">{item.productName}</p>
                        <p className="mt-1 font-body text-[11px] font-medium uppercase tracking-wider text-dark-grey">
                          {item.sizeMode === "CUSTOM" ? "Made to measure" : item.size}
                        </p>
                        {item.color && (
                          <p className="mt-0.5 text-xs text-charcoal-light">{item.color}</p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            disabled={item.quantity <= 1}
                            className="flex h-7 w-7 items-center justify-center rounded-sm border border-border text-sm disabled:opacity-40"
                            aria-label={`Decrease quantity of ${item.productName}`}
                            onClick={() => void changeQty(item.id, item.quantity - 1)}
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-sm border border-border text-sm"
                            aria-label={`Increase quantity of ${item.productName}`}
                            onClick={() => void changeQty(item.id, item.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="shrink-0 text-right font-medium text-charcoal">
                        {fmtLine(item)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <footer className="shrink-0 border-t border-[var(--border)] bg-[var(--off-white)] px-5 py-5">
                {points > 0 && (
                  <div className="mb-3 inline-flex bg-cream px-3 py-1 font-body text-[10px] font-medium uppercase tracking-wide text-charcoal">
                    You&apos;ll earn {points} points on this order
                  </div>
                )}
                <div className="flex items-baseline justify-between">
                  <span className="font-label text-xs uppercase text-charcoal-mid">Subtotal</span>
                  <span className="font-display text-lg text-charcoal">{formatPrice(subtotalShopper, currency)}</span>
                </div>
                <p className="mt-1 text-xs text-charcoal-light">Shipping calculated at checkout</p>
                <Button
                  type="button"
                  className="mt-4 w-full"
                  size="lg"
                  onClick={() => {
                    closeCart();
                    router.push("/checkout");
                  }}
                >
                  View Bag & Checkout
                </Button>
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={closeCart}
                    className="font-body text-[11px] font-medium uppercase tracking-wider text-choc underline-offset-4 hover:underline"
                  >
                    Continue Shopping
                  </button>
                </div>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
