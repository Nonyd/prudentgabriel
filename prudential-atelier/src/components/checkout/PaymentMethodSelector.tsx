"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import clsx from "clsx";
import { Building2, CreditCard, Globe, Landmark, Upload } from "lucide-react";
import toast from "react-hot-toast";
import type { PaymentCurrency, PaymentGatewayType } from "@/lib/payments/index";
import { formatPrice } from "@/lib/currency";
type Props = {
  currency: PaymentCurrency;
  amount: number;
  selected: PaymentGatewayType | null;
  onSelect: (gateway: PaymentGatewayType) => void;
  receiptUrl?: string | null;
  onReceiptUploaded?: (url: string) => void;
  guestEmail?: string | null;
};

const GATEWAY_META: Record<
  Exclude<PaymentGatewayType, "BANK_TRANSFER">,
  { title: string; subtitle: string; icon: typeof CreditCard; badge?: string }
> = {
  PAYSTACK: {
    title: "Card Payment",
    subtitle: "Visa, Mastercard, Verve",
    icon: CreditCard,
    badge: "NGN",
  },
  FLUTTERWAVE: {
    title: "Pay with Flutterwave",
    subtitle: "Cards, Mobile Money, Bank",
    icon: Globe,
  },
  STRIPE: {
    title: "International Card",
    subtitle: "Visa, Mastercard",
    icon: CreditCard,
    badge: "USD/£",
  },
  MONNIFY: {
    title: "Bank Transfer / USSD",
    subtitle: "Direct bank payment",
    icon: Landmark,
    badge: "NGN",
  },
};

export function PaymentMethodSelector({
  currency,
  amount,
  selected,
  onSelect,
  receiptUrl,
  onReceiptUploaded,
  guestEmail,
}: Props) {
  const { status } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [gateways, setGateways] = useState<PaymentGatewayType[]>([]);
  const [bank, setBank] = useState({ bankName: "", accountNumber: "", accountName: "" });

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/payments/public-config")
      .then((r) => r.json())
      .then((data: {
        bank?: { bankName: string; accountNumber: string; accountName: string };
        gateways?: Record<PaymentCurrency, PaymentGatewayType[]>;
      }) => {
        if (cancelled) return;
        if (data.bank) setBank(data.bank);
        setGateways(data.gateways?.[currency] ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setGateways(
            currency === "NGN"
              ? ["PAYSTACK", "FLUTTERWAVE", "MONNIFY", "BANK_TRANSFER"]
              : ["FLUTTERWAVE", "STRIPE"],
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currency]);

  async function uploadReceipt(file: File) {
    if (!onReceiptUploaded) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      if (status !== "authenticated") {
        const email = guestEmail?.trim();
        if (!email) throw new Error("Enter your email before uploading a receipt");
        const tr = await fetch("/api/upload/receipt/ticket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const tj = (await tr.json()) as { ticket?: string; exp?: number; error?: string };
        if (!tr.ok || !tj.ticket || !tj.exp) throw new Error(tj.error ?? "Could not start upload");
        fd.set("email", email);
        fd.set("ticket", tj.ticket);
        fd.set("exp", String(tj.exp));
      }
      const res = await fetch("/api/upload/receipt", { method: "POST", body: fd });
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) throw new Error(j.error ?? "Upload failed");
      onReceiptUploaded(j.url);
      toast.success("Receipt uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-lightbr">How would you like to pay?</p>
      <div className="mt-4 space-y-2">
        {gateways.map((gw) => {
          if (gw === "BANK_TRANSFER") {
            const isSelected = selected === "BANK_TRANSFER";
            return (
              <div key={gw}>
                <button
                  type="button"
                  onClick={() => onSelect("BANK_TRANSFER")}
                  className={clsx(
                    "flex w-full items-start gap-3 rounded-sm border p-4 text-left transition-colors",
                    isSelected
                      ? "border-[1.5px] border-choc bg-[rgba(68,41,19,0.04)]"
                      : "border-[0.5px] border-sand bg-bg-card",
                  )}
                >
                  <span
                    className={clsx(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      isSelected ? "border-nut bg-nut" : "border-sand",
                    )}
                  >
                    {isSelected ? <span className="h-1.5 w-1.5 rounded-full bg-cream" /> : null}
                  </span>
                  <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-choc" strokeWidth={1.25} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-body text-sm text-choc">Direct Bank Transfer</p>
                      <span className="font-sans text-[10px] uppercase text-lightbr">NGN</span>
                    </div>
                    <p className="mt-0.5 font-body text-xs text-text-light">Upload proof of payment</p>
                  </div>
                </button>
                {isSelected ? (
                  <div className="mt-2 rounded-sm border border-sand bg-[#FAF7F2] p-4 font-body text-sm text-text-mid">
                    <p>
                      <span className="text-text-light">Bank:</span> {bank.bankName}
                    </p>
                    <p className="mt-1">
                      <span className="text-text-light">Account:</span> {bank.accountNumber}
                    </p>
                    <p className="mt-1">
                      <span className="text-text-light">Name:</span> {bank.accountName}
                    </p>
                    <p className="mt-2 font-serif text-lg text-choc">{formatPrice(amount, currency)}</p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadReceipt(f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                      className="mt-4 inline-flex items-center gap-2 rounded-sm border border-choc bg-bg-card px-4 py-2 font-sans text-[10px] uppercase tracking-wider text-choc"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploading ? "Uploading…" : receiptUrl ? "Replace receipt" : "Upload payment receipt"}
                    </button>
                    <p className="mt-2 font-sans text-[10px] text-text-light">Accepted: JPG, PNG, PDF · Max 5MB</p>
                    {receiptUrl ? (
                      <p className="mt-2 font-sans text-xs text-nut">Receipt attached ✓</p>
                    ) : null}
                    <p className="mt-3 font-body text-xs text-text-light">
                      After uploading, click confirm below. Our team will verify within 2–4 hours.
                    </p>
                  </div>
                ) : null}
              </div>
            );
          }

          const meta = GATEWAY_META[gw];
          const Icon = meta.icon;
          const isSelected = selected === gw;
          const badge =
            gw === "STRIPE" ? (currency === "GBP" ? "GBP" : "USD") : gw === "FLUTTERWAVE" ? currency : meta.badge;

          return (
            <button
              key={gw}
              type="button"
              onClick={() => onSelect(gw)}
              className={clsx(
                "flex w-full items-start gap-3 rounded-sm border p-4 text-left transition-colors",
                isSelected
                  ? "border-[1.5px] border-choc bg-[rgba(68,41,19,0.04)]"
                  : "border-[0.5px] border-sand bg-bg-card",
              )}
            >
              <span
                className={clsx(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  isSelected ? "border-nut bg-nut" : "border-sand",
                )}
              >
                {isSelected ? <span className="h-1.5 w-1.5 rounded-full bg-cream" /> : null}
              </span>
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-choc" strokeWidth={1.25} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-body text-sm text-choc">{meta.title}</p>
                  {badge ? (
                    <span className="font-sans text-[10px] uppercase text-lightbr">{badge}</span>
                  ) : null}
                </div>
                <p className="mt-0.5 font-body text-xs text-text-light">{meta.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
