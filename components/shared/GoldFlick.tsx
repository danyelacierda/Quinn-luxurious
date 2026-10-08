"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The site's signature mark: four sweeping strokes evoking individual
 * lash fans, animating in like they're being drawn on. Used under
 * eyebrows/kickers throughout the site to tie the visual language back
 * to lash artistry.
 */
export function GoldFlick({ className, delay = 0.2 }: { className?: string; delay?: number }) {
  const paths = [
    { d: "M2 16C10 4 16 2 20 10", width: 1.6 },
    { d: "M18 17C28 3 36 1 42 11", width: 1.9 },
    { d: "M40 17C52 1 62 0 70 12", width: 1.6 },
    { d: "M66 16C74 6 78 5 84 10", width: 1.4 },
  ];

  return (
    <svg
      viewBox="0 0 86 20"
      className={cn("h-4 w-20", className)}
      fill="none"
      aria-hidden="true"
    >
      {paths.map((p, i) => (
        <motion.path
          key={p.d}
          d={p.d}
          stroke="#B6874F"
          strokeWidth={p.width}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: delay + i * 0.08, ease: "easeInOut" }}
        />
      ))}
    </svg>
  );
}
