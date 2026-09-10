"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { formatPrice } from "@/lib/utils";

export type WishlistItemView = {
  id: string;
  productId: string;
  name: string;
  slug: string;
  price: number;
  imageUrl: string | null;
  defaultVariantId: string | null;
  defaultSize: string | null;
};

export function WishlistClient({ items: initial }: { items: WishlistItemView[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(productId: string) {
    setBusyId(productId);
    try {
      const res = await fetch(`/api/account/wishlist/${productId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setItems((list) => list.filter((i) => i.productId !== productId));
      toast.success("Removed from wishlist");
      router.refresh();
    } catch {
      toast.error("Could not remove item");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="mt-16 text-center">
        <p className="font-sans text-sm text-text-mid">Your wishlist is empty — browse the collection.</p>
        <Link href="/rtw" className="btn-primary mt-6 inline-flex">
          Browse collection
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <article key={item.id} className="relative border border-sand/60 bg-ivory">
          <Link href={`/shop/${item.slug}`} className="block">
            <div className="relative aspect-[3/4] bg-sand/20">
              {item.imageUrl ? (
                <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="320px" />
              ) : null}
            </div>
            <div className="p-4">
              <h2 className="font-serif text-lg text-choc">{item.name}</h2>
              <p className="mt-1 font-sans text-sm text-nut">{formatPrice(item.price, "NGN")}</p>
            </div>
          </Link>
          <div className="flex gap-2 border-t border-sand/40 p-4">
            <Link href={`/shop/${item.slug}`} className="btn-primary flex-1 text-center text-[10px]">
              Shop now
            </Link>
            <button
              type="button"
              disabled={busyId === item.productId}
              onClick={() => remove(item.productId)}
              className="btn-ghost-light px-4 text-[10px]"
            >
              Remove
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
