"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Sparkle } from "lucide-react";
import { cn } from "@/lib/utils";

type GalleryTileProps = {
  label: string;
  gradient: string;
  src?: string;
  index?: number;
  className?: string;
};

/**
 * Renders a real photo via next/image when `src` is provided.
 * Until real studio photography is added, falls back to a soft
 * branded gradient tile so the layout never depends on a hotlinked
 * or broken image URL.
 */
export function GalleryTile({ label, gradient, src, index = 0, className }: GalleryTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: (index % 6) * 0.06 }}
      className={cn(
        "group relative overflow-hidden rounded-3xl shadow-soft transition-shadow duration-300 hover:shadow-card",
        className
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={label}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/0 transition-colors duration-300 group-hover:bg-ink/25">
        <Sparkle className="h-5 w-5 text-ivory opacity-0 transition-opacity duration-300 group-hover:opacity-90" />
        <span className="px-3 text-center text-xs font-semibold uppercase tracking-wider text-ivory opacity-0 transition-opacity duration-300 group-hover:opacity-90">
          {label}
        </span>
      </div>
    </motion.div>
  );
}
