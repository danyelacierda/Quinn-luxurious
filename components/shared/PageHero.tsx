"use client";

import { motion } from "framer-motion";
import { GoldFlick } from "./GoldFlick";

export function PageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <section className="relative bg-cream section-padding !pb-16 !pt-16 md:!pt-20">
      <div className="container flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <span className="eyebrow">{eyebrow}</span>
          <GoldFlick className="mt-2" />
          <h1 className="mt-4 font-display text-4xl sm:text-5xl md:text-6xl font-semibold text-ink text-balance max-w-2xl">
            {title}
          </h1>
          {description && (
            <p className="mt-4 max-w-xl text-ink-soft leading-relaxed">{description}</p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
