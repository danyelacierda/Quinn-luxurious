"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarCheck2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/data";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="container relative grid gap-16 py-16 md:grid-cols-[1.1fr,0.9fr] md:py-24 lg:py-28">
        {/* Left: content */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="flex flex-col justify-center"
        >
          <span className="eyebrow">Boutique Lash &amp; Nail Studio</span>
          <h1 className="mt-4 font-display text-5xl sm:text-6xl md:text-7xl font-semibold leading-[1.05] text-ink text-balance">
            {siteConfig.name}
          </h1>
          <p className="mt-3 font-display text-2xl sm:text-3xl text-gold-dark italic">
            {siteConfig.tagline}
          </p>
          <p className="mt-6 max-w-md text-ink-soft leading-relaxed">
            {siteConfig.description}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button size="lg" asChild>
              <Link href="/appointment">Book Appointment</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/services">View Services</Link>
            </Button>
          </div>

          <div className="mt-12 flex items-center gap-6">
            <div className="flex -space-x-3">
              {["A", "P", "S", "M"].map((initial) => (
                <span
                  key={initial}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ivory bg-blush text-sm font-semibold text-rose-dark"
                >
                  {initial}
                </span>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1 text-gold">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-gold" />
                ))}
              </div>
              <p className="text-xs text-ink-soft mt-0.5">Loved by 800+ clients</p>
            </div>
          </div>
        </motion.div>

        {/* Right: abstract gold/silk gradient panel + floating card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
          className="relative flex items-center justify-center"
        >
          <div className="relative aspect-[4/5] w-full max-w-md overflow-hidden rounded-4xl shadow-card">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 25% 20%, #E7C7C2 0%, transparent 45%), radial-gradient(circle at 80% 75%, #E8D3B3 0%, transparent 55%), linear-gradient(160deg, #FBF6EF 0%, #F4ECE0 45%, #E7C7C2 100%)",
              }}
            />
            {/* ambient floating blobs */}
            <motion.div
              className="absolute -left-8 top-10 h-40 w-40 rounded-full bg-rose/30 blur-2xl"
              animate={{ y: [0, -14, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute bottom-10 right-0 h-52 w-52 rounded-full bg-gold/25 blur-3xl"
              animate={{ y: [0, 16, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            />

            {/* subtle radial "vanity mirror" ring */}
            <div className="absolute inset-8 rounded-full border border-gold/25" />
            <div className="absolute inset-14 rounded-full border border-gold/15" />

            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-display text-7xl text-gold/50 select-none">Q</span>
            </div>
          </div>

          {/* Floating "next available" card — the hero's signature device */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="absolute -bottom-6 left-2 sm:left-6 w-64 rounded-3xl bg-white/95 p-5 shadow-gold backdrop-blur border border-gold/15 animate-float"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/10 text-gold-dark">
                <CalendarCheck2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-ink-soft">Next available</p>
                <p className="text-sm font-semibold text-ink">Tomorrow, 2:30 PM</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
