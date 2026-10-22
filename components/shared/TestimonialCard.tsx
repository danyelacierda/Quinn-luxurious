"use client";

import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

type TestimonialCardProps = {
  name: string;
  service?: string;
  quote: string;
  rating: number;
  index?: number;
};

export function TestimonialCard({ name, service = "Verified Client", quote, rating, index = 0 }: TestimonialCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
      className="flex h-full flex-col rounded-3xl bg-white p-7 shadow-soft border border-gold/10"
    >
      <Quote className="h-7 w-7 text-gold/40" />
      <p className="mt-4 flex-1 font-display text-lg italic leading-relaxed text-ink">
        “{quote}”
      </p>
      <div className="mt-6 flex items-center justify-between border-t border-gold/10 pt-4">
        <div>
          <p className="text-sm font-semibold text-ink">{name}</p>
          <p className="text-xs text-ink-soft">{service}</p>
        </div>
        <div className="flex gap-0.5 text-gold">
          {Array.from({ length: rating }).map((_, i) => (
            <Star key={i} className="h-3.5 w-3.5 fill-gold" />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
