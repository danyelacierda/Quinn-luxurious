"use client";
import { motion } from "framer-motion";
import React from "react";

export function SplitText({ children, className = "" }: { children: string; className?: string }) {
  const words = children.split(" ");
  return (
    <span className={`inline-block ${className}`}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden whitespace-nowrap">
          <motion.span
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block"
          >
            {word}
          </motion.span>
          {i !== words.length - 1 && "\u00A0"}
        </span>
      ))}
    </span>
  );
}
