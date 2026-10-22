"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type FeatureCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  index?: number;
};

export function FeatureCard({ icon, title, description, index = 0 }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
      className="group rounded-3xl border border-transparent bg-white/60 p-7 text-center shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-gold-pale hover:bg-white hover:shadow-signature"
    >
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-gold-dark ring-1 ring-gold/20 transition-transform duration-300 group-hover:scale-110">
        {icon}
      </span>
      <h3 className="mt-5 font-display text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p>
    </motion.div>
  );
}
