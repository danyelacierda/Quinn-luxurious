"use client";
import { motion } from "framer-motion";
import React from "react";

export function ShinyText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`relative inline-block overflow-hidden ${className}`}>
      {children}
      <motion.span
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: "linear-gradient(120deg, transparent 40%, rgba(255, 255, 255, 0.4) 50%, transparent 60%)",
          backgroundSize: "200% 100%",
        }}
        initial={{ backgroundPosition: "100% 0" }}
        animate={{ backgroundPosition: "-100% 0" }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "linear", repeatDelay: 1 }}
      />
    </span>
  );
}
