"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";

interface StockAlertFormProps {
  emailDefault?: string | null;
  productId: string;
  variantId?: string | null;
}

export function StockAlertForm({ emailDefault, productId, variantId }: StockAlertFormProps) {
  const { data: session } = useSession();
  const [email, setEmail] = useState(emailDefault ?? session?.user?.email ?? "");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stock-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          productId,
          ...(variantId ? { variantId } : {}),
        }),
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      setError("Could not save that. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return <p className="mt-3 font-body text-sm text-choc">We will email you when this is back.</p>;
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <p className="font-body text-base font-medium text-choc">Notify me when it returns</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          className="flex-1 rounded-sm border border-border bg-cream px-3 py-2 text-sm"
        />
        <Button type="submit" loading={loading} size="sm">
          Notify me
        </Button>
      </div>
      {error ? (
        <p className="font-body text-sm text-choc" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
