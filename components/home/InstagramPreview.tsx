"use client";

import { motion } from "framer-motion";
import { Instagram } from "lucide-react";
import Image from "next/image";
import { SectionHeading } from "@/components/shared/SectionHeading";

// Swap these gradients for real @quinnluxurious post thumbnails once available.
const tiles = [
  "/gallery/lash_extensions.jpg",
  "/gallery/nail_art.jpg",
  "/gallery/brow_lamination.jpg",
  "/gallery/studio_interior.jpg",
  "/gallery/lash_extensions.jpg",
  "/gallery/nail_art.jpg",
];

export function InstagramPreview() {
  return (
    <section className="section-padding bg-paper">
      <div className="container">
        <SectionHeading
          eyebrow="Follow Along"
          title="@quinnluxurious"
          description="Fresh sets, finished nails, and behind-the-scenes moments from the studio."
        />

        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {tiles.map((src, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group relative aspect-square overflow-hidden rounded-2xl shadow-soft"
            >
              <Image 
                src={src} 
                alt="Instagram post preview" 
                fill 
                className="object-cover transition-transform duration-500 group-hover:scale-105" 
              />
              <div className="absolute inset-0 flex items-center justify-center bg-ink/0 transition-colors duration-300 group-hover:bg-ink/20">
                <Instagram className="h-6 w-6 text-ivory opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gold-dark hover:text-gold transition-colors"
          >
            <Instagram className="h-4 w-4" />
            View more on Instagram
          </a>
        </div>
      </div>
    </section>
  );
}
