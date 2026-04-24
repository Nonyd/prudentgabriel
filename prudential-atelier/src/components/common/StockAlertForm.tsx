"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";

interface StockAlertFormProps {
  emailDefault?: string | null;
  productId: string;
  variantId: string;
}

export function StockAlertForm({ emailDefault, productId, variantId }: StockAlertFormProps) {
  const { data: session } = useSession();
  const [email, setEmail] = useState(emailDefault ?? session?.user?.email ?? "");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/stock-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, productId, variantId }),
      });
      if (res.ok) setDone(true);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return <p className="text-sm text-success">We&apos;ll email you when this is back in stock ✓</p>;
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
        className="flex-1 rounded-sm border border-border bg-cream px-3 py-2 text-sm"
      />
      <Button type="submit" loading={loading} size="sm">
        Notify Me When Back
      </Button>
    </form>
  );
}
