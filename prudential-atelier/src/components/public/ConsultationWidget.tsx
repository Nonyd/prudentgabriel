"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const CONSULTATION_TYPES = [
  { id: "virtual", label: "Virtual Consultation", price: "₦25,000", duration: "60 min" },
  { id: "in-person-prudent", label: "In-Person with Mrs. Prudent", price: "₦75,000", duration: "90 min" },
  { id: "in-person-team", label: "In-Person with Atelier Team", price: "₦45,000", duration: "60 min" },
];

export function ConsultationWidget() {
  return (
    <section className="grid lg:grid-cols-2">
      <div className="bg-sand px-6 py-16 lg:px-12 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <p className="eyebrow">Consultations</p>
          <h2 className="mt-3 font-serif text-[clamp(2rem,3vw,2.625rem)] font-medium text-choc">
            Begin a Commission
          </h2>
          <ul className="mt-10 space-y-6">
            {CONSULTATION_TYPES.map((type) => (
              <li key={type.id} className="border-b border-choc/10 pb-6 last:border-0">
                <p className="font-serif text-xl font-medium text-choc">{type.label}</p>
                <p className="mt-1 font-sans text-xs text-text-mid">
                  {type.duration} · {type.price}
                </p>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      <div className="bg-choc px-6 py-16 text-cream lg:px-12 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <p className="eyebrow text-lightbr">Quick Book</p>
          <h3 className="mt-3 font-serif text-2xl font-medium">Reserve Your Session</h3>
          <form className="mt-8 space-y-4" onSubmit={(e) => e.preventDefault()}>
            <label className="block">
              <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-cream/80">
                Consultation type
              </span>
              <select className="input-field w-full bg-bg/10 text-text-dark">
                {CONSULTATION_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-cream/80">
                Preferred date
              </span>
              <input type="date" className="input-field w-full bg-bg/10" />
            </label>
            <label className="block">
              <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-cream/80">
                Virtual medium
              </span>
              <select className="input-field w-full bg-bg/10 text-text-dark">
                <option>Zoom</option>
                <option>Google Meet</option>
                <option>WhatsApp Call</option>
                <option>WhatsApp Video</option>
              </select>
            </label>
            <Link href="/consultation" className="btn-primary mt-4 inline-flex w-full justify-center">
              Proceed to Payment
            </Link>
          </form>
        </motion.div>
      </div>
    </section>
  );
}
