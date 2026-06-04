"use client";

import { motion } from "framer-motion";
import { Crown, Gem, Sparkles, Star } from "lucide-react";

const TIERS = [
  { name: "Bronze", perk: "Birthday styling note", icon: Star },
  { name: "Silver", perk: "Priority consultation slots", icon: Sparkles },
  { name: "Gold", perk: "Exclusive preview access", icon: Gem },
  { name: "Platinum", perk: "Private atelier appointments", icon: Crown },
];

export function LoyaltyStrip() {
  return (
    <section className="border-y border-sand bg-ivory px-6 py-16 lg:px-10">
      <div className="mx-auto max-w-site">
        <p className="eyebrow text-center">Inner Circle</p>
        <h2 className="mt-3 text-center font-serif text-[clamp(1.75rem,3vw,2.25rem)] font-medium text-choc">
          Loyalty Tiers
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier, index) => {
            const Icon = tier.icon;
            return (
            <motion.div
              key={tier.name}
              className="card-surface p-6 text-center"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true, margin: "-80px" }}
            >
              <Icon className="mx-auto h-5 w-5 text-lightbr" strokeWidth={1.5} />
              <p className="mt-4 font-serif text-xl font-medium text-choc">{tier.name}</p>
              <p className="mt-2 font-sans text-xs font-light leading-relaxed text-text-mid">
                {tier.perk}
              </p>
            </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
