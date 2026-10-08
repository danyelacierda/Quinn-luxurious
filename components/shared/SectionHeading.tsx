"use client";

import { motion } from "framer-motion";
import { GoldFlick } from "./GoldFlick";
import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: SectionHeadingProps) {
  const isCenter = align === "center";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={cn("flex flex-col", isCenter ? "items-center text-center" : "items-start text-left", className)}
    >
      <span className="eyebrow">{eyebrow}</span>
      <GoldFlick className="mt-2" />
      <h2 className="mt-4 font-display text-3xl sm:text-4xl md:text-5xl font-semibold text-ink text-balance max-w-2xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 max-w-xl text-ink-soft leading-relaxed">{description}</p>
      )}
    </motion.div>
  );
}
