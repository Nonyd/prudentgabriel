"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Heart } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useWishlistStore } from "@/store/wishlistStore";

interface WishlistButtonProps {
  productId: string;
  className?: string;
}

export function WishlistButton({ productId, className }: WishlistButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();
  const inList = useWishlistStore((s) => s.isInWishlist(productId));
  const toggleLocal = useWishlistStore((s) => s.toggleWishlist);
  const addLocal = useWishlistStore((s) => s.addToWishlist);
  const removeLocal = useWishlistStore((s) => s.removeFromWishlist);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status !== "authenticated") {
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
      return;
    }

    const wasIn = inList;
    toggleLocal(productId);

    try {
      if (wasIn) {
        const res = await fetch(`/api/wishlist?productId=${encodeURIComponent(productId)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error();
      } else {
        const res = await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
        if (!res.ok) throw new Error();
      }
    } catch {
      if (wasIn) addLocal(productId);
      else removeLocal(productId);
      toast.error("Could not update wishlist. Try again.");
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center p-0 transition-colors",
        "hover:bg-olive-light/50",
        className,
      )}
      aria-label={inList ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Heart
        className={cn(
          "h-4 w-4 transition-colors",
          inList ? "fill-olive text-olive" : "text-charcoal/50 hover:text-olive",
        )}
        strokeWidth={inList ? 0 : 1.5}
      />
    </button>
  );
}
