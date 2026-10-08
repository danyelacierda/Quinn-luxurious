"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { GoldFlick } from "@/components/shared/GoldFlick";

export function CallToAction() {
  return (
    <section className="relative overflow-hidden bg-ink section-padding">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 15% 30%, rgba(184,145,47,0.25) 0%, transparent 50%), radial-gradient(circle at 85% 70%, rgba(201,138,150,0.2) 0%, transparent 50%)",
        }}
      />
      <div className="container relative flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center"
        >
          <span className="eyebrow text-gold">Reserve Your Time</span>
          <GoldFlick className="mt-2" />
          <h2 className="mt-4 max-w-xl font-display text-3xl sm:text-4xl md:text-5xl font-semibold text-ivory text-balance">
            Your Next Look Starts With One Appointment
          </h2>
          <p className="mt-4 max-w-md text-ivory/70 leading-relaxed">
            Limited daily slots keep every visit unhurried. Save yours before the week fills up.
          </p>
          <div className="mt-9">
            <Button size="lg" asChild>
              <Link href="/appointment">Book Appointment</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
