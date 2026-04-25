"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PaymentGateway } from "@prisma/client";
import { LogOut, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { DarkModeToggle } from "@/components/common/DarkModeToggle";

type SafeMethod = {
  id: string;
  gateway: PaymentGateway;
  cardLast4: string | null;
  cardBrand: string | null;
  cardExpiry: string | null;
  isDefault: boolean;
  nickname: string | null;
  createdAt: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (parts[0] || "ME").slice(0, 2).toUpperCase();
}

export function CustomerProfileDrawer({
  isOpen,
  onClose,
  name,
  email,
  pointsBalance,
}: {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  email: string;
  pointsBalance: number;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [firstName, setFirstName] = useState(name.split(" ")[0] || "");
  const [lastName, setLastName] = useState(name.split(" ").slice(1).join(" "));
  const [phone, setPhone] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [preferredGateway, setPreferredGateway] = useState<PaymentGateway>("PAYSTACK");
  const [methods, setMethods] = useState<SafeMethod[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const run = async () => {
      const [profileRes, methodsRes] = await Promise.all([
        fetch("/api/account/profile"),
        fetch("/api/account/payment-methods"),
      ]);
      if (profileRes.ok) {
        const profile = (await profileRes.json()) as { preferredGateway?: PaymentGateway | null; phone?: string | null; image?: string | null };
        setPreferredGateway(profile.preferredGateway || "PAYSTACK");
        setPhone(profile.phone || "");
        setImage(profile.image || null);
      }
      if (methodsRes.ok) {
        const payload = (await methodsRes.json()) as { methods: SafeMethod[] };
        setMethods(payload.methods);
      }
    };
    void run();
  }, [isOpen]);

  async function saveProfile() {
    await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, phone }),
    });
  }

  async function savePreferredGateway() {
    await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferredGateway }),
    });
  }

  async function uploadAvatar(file: File) {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", "prudential-atelier/avatars/customer");
    const response = await fetch("/api/admin/upload", { method: "POST", body: form });
    if (!response.ok) return;
    const json = (await response.json()) as { url?: string };
    if (json.url) {
      setImage(json.url);
      await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: json.url }),
      });
    }
  }

  async function makeDefault(methodId: string) {
    await fetch(`/api/account/payment-methods/${methodId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    setMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === methodId })));
  }

  async function removeMethod(methodId: string) {
    const response = await fetch(`/api/account/payment-methods/${methodId}`, { method: "DELETE" });
    if (!response.ok) return;
    setMethods((prev) => prev.filter((m) => m.id !== methodId));
  }

  async function addQuickMethod(gateway: "PAYSTACK" | "STRIPE") {
    if (gateway === "PAYSTACK") {
      const authCode = window.prompt("Enter Paystack auth code");
      if (!authCode) return;
      await fetch("/api/account/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway: "PAYSTACK", authCode, last4: "0000", brand: "Card", expiry: "12/26", email }),
      });
    } else {
      const paymentMethodId = window.prompt("Enter Stripe payment method id");
      if (!paymentMethodId) return;
      await fetch("/api/account/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway: "STRIPE", paymentMethodId, last4: "0000", brand: "Card", expiry: "12/2026" }),
      });
    }
    const methodsRes = await fetch("/api/account/payment-methods");
    if (methodsRes.ok) {
      const payload = (await methodsRes.json()) as { methods: SafeMethod[] };
      setMethods(payload.methods);
    }
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-40 bg-black/20"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[360px] flex-col border-l border-[#EBEBEA] bg-white"
            initial={{ x: 360 }}
            animate={{ x: 0 }}
            exit={{ x: 360 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between border-b border-[#EBEBEA] px-6 py-4">
              <h3 className="font-display text-[20px] text-ink">Account</h3>
              <button type="button" onClick={onClose} className="text-[#6B6B68] hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6" data-lenis-prevent>
              <div className="mb-5 flex flex-col items-center">
                {image ? (
                  <img src={image} alt="Customer avatar" className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#6B1C2A] font-body text-lg text-white">
                    {initials(name)}
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAvatar(file);
                }} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 font-body text-[11px] text-[#6B6B68]">Change Photo</button>
                <p className="mt-2 font-display text-[18px] text-ink">{name}</p>
                <p className="font-body text-xs text-[#6B6B68]">{email}</p>
                <span className="mt-1 bg-[#37392d] px-2 py-0.5 font-body text-[10px] text-white">{pointsBalance} pts</span>
              </div>

              <div className="space-y-2">
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First Name" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
                <button type="button" onClick={() => void saveProfile()} className="w-full bg-[#37392d] px-3 py-2 font-body text-[12px] uppercase tracking-[0.08em] text-white">
                  Save Changes
                </button>
              </div>

              <div className="my-5 border-t border-[#EBEBEA]" />
              <p className="mb-2 font-body text-[11px] uppercase tracking-[0.08em] text-[#6B6B68]">Payment Preferences</p>
              <div className="space-y-2">
                {(["PAYSTACK", "FLUTTERWAVE", "STRIPE", "MONNIFY"] as PaymentGateway[]).map((gateway) => (
                  <label key={gateway} className="flex items-center justify-between border border-[#EBEBEA] px-3 py-2 font-body text-sm">
                    <span>{gateway}</span>
                    <input type="radio" checked={preferredGateway === gateway} onChange={() => setPreferredGateway(gateway)} />
                  </label>
                ))}
                <button type="button" onClick={() => void savePreferredGateway()} className="w-full border border-[#37392d] px-3 py-2 font-body text-[11px] uppercase tracking-[0.08em] text-[#37392d]">
                  Save Preference
                </button>
              </div>

              <div className="mt-5">
                <p className="mb-2 font-body text-[11px] uppercase tracking-[0.08em] text-[#6B6B68]">Saved Cards</p>
                <div className="space-y-2">
                  {methods.map((method) => (
                    <div key={method.id} className="border border-[#EBEBEA] px-3 py-2">
                      <p className="font-body text-sm text-ink">{method.cardBrand || "Card"} •••• {method.cardLast4 || "****"}</p>
                      <p className="font-body text-[11px] text-[#6B6B68]">{method.cardExpiry || "N/A"} · {method.gateway}</p>
                      <div className="mt-1 flex items-center gap-3">
                        <button type="button" onClick={() => void makeDefault(method.id)} className="font-body text-[11px] text-[#37392d] hover:underline">
                          {method.isDefault ? "Default" : "Set Default"}
                        </button>
                        <button type="button" onClick={() => void removeMethod(method.id)} className="font-body text-[11px] text-red-600 hover:underline">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => void addQuickMethod("PAYSTACK")} className="flex-1 border border-[#EBEBEA] px-2 py-2 font-body text-[11px]">+ Add Paystack</button>
                  <button type="button" onClick={() => void addQuickMethod("STRIPE")} className="flex-1 border border-[#EBEBEA] px-2 py-2 font-body text-[11px]">+ Add Stripe</button>
                </div>
              </div>

              <div className="my-5 border-t border-[#EBEBEA]" />
              <div className="flex items-center justify-between">
                <p className="font-body text-[11px] uppercase tracking-[0.08em] text-[#6B6B68]">Display Preferences</p>
                <DarkModeToggle />
              </div>
            </div>

            <div className="border-t border-[#EBEBEA] px-6 py-4">
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/" })}
                className="flex w-full items-center justify-center gap-2 border border-[#EBEBEA] px-3 py-2 font-body text-xs text-[#37392d] hover:text-red-600"
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
