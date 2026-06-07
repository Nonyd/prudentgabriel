"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { formatPrice } from "@/lib/utils";

export type BestSellerProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  category: string;
  images: string[];
};

export function BestSellersGrid({ products }: { products: BestSellerProduct[] }) {
  return (
    <div className="mt-12 grid grid-cols-2 gap-8 lg:grid-cols-4">
      {products.map((product, index) => (
        <motion.div
          key={product.id}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: index * 0.08 }}
          viewport={{ once: true, margin: "-80px" }}
          whileHover={{ y: -4 }}
        >
          <Link href={`/rtw/${product.slug}`} className="group block">
            <p
              className="mb-3 uppercase"
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "10px",
                color: "var(--lightbr)",
              }}
            >
              {product.category}
            </p>
            <div className="img-portrait relative bg-bg">
              {product.images[0] ? (
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-[1.02]"
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
              ) : (
                <div
                  className="flex h-full items-center justify-center font-serif text-lg"
                  style={{ color: "var(--lightbr)" }}
                >
                  No image
                </div>
              )}
              <span
                className="absolute left-3 top-3 rounded-full px-2.5 py-1 uppercase"
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: "9px",
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  backgroundColor: "#6B1C2A",
                  color: "var(--cream)",
                }}
              >
                Best Seller
              </span>
            </div>
            <p
              className="mt-4"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "18px",
                color: "var(--choc)",
              }}
            >
              {product.name}
            </p>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "13px",
                color: "var(--text-mid)",
              }}
            >
              {formatPrice(product.price, "NGN")}
            </p>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
