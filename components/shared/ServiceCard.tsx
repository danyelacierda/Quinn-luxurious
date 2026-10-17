"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type ServiceCardProps = {
  service: {
    id?: string;
    title: string;
    description: string | null;
    duration: string;
    price: string;
    category?: string;
    imageUrl?: string;
  };
  icon: ReactNode;
  index?: number;
};

export function ServiceCard({ service, icon, index = 0 }: ServiceCardProps) {
  const [imgSrc, setImgSrc] = useState(service.imageUrl || "/gallery/studio_interior.jpg");
  const appointmentHref = service.id
    ? `/appointment?serviceId=${encodeURIComponent(service.id)}`
    : "/appointment";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
      className="h-full"
    >
      <Link href={appointmentHref} className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-3xl">
        <Card className="h-full overflow-hidden rounded-3xl border-border bg-white transition-all duration-300 hover:-translate-y-1.5 hover:shadow-card hover:border-gold/40 flex flex-col">
          {/* Service Photography Header */}
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-cream">
            <img
              src={imgSrc}
              alt={service.title}
              onError={() => setImgSrc("/gallery/studio_interior.jpg")}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              loading="lazy"
            />
            {/* Gradient Scrim */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-ink/20" />

            {/* Category Pill */}
            {service.category && (
              <span className="absolute top-3.5 left-3.5 rounded-full bg-paper/90 backdrop-blur-md px-3 py-1 text-[11px] font-medium tracking-wide uppercase text-ink shadow-sm">
                {service.category}
              </span>
            )}

            {/* Icon Pill */}
            <span className="absolute top-3.5 right-3.5 flex h-9 w-9 items-center justify-center rounded-full bg-paper/90 backdrop-blur-md text-gold-dark shadow-sm transition-transform duration-300 group-hover:scale-110">
              {icon}
            </span>

            {/* Bottom Photo Overlay Info */}
            <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between text-xs text-paper/95 drop-shadow-sm font-medium">
              <span className="flex items-center gap-1.5 bg-ink/40 backdrop-blur-md px-2.5 py-1 rounded-full">
                <Clock className="h-3.5 w-3.5 text-gold-light" />
                {service.duration}
              </span>
              <span className="bg-gold/90 backdrop-blur-md px-2.5 py-1 rounded-full font-semibold text-white">
                {service.price}
              </span>
            </div>
          </div>

          <CardContent className="flex flex-1 flex-col p-6">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-2xl font-semibold text-ink group-hover:text-gold-dark transition-colors duration-200">
                {service.title}
              </h3>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-ink/30 transition-all duration-300 group-hover:text-gold-dark group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>

            <p className="mt-2.5 text-sm leading-relaxed text-ink-soft flex-1 line-clamp-3">
              {service.description || "Individually customized service tailored to your personal aesthetic."}
            </p>

            <div className="mt-6 flex items-center justify-between border-t border-gold/15 pt-4 text-xs font-medium">
              <span className="text-ink-soft">Boutique Consultation</span>
              <span className="font-semibold text-gold-dark group-hover:underline">
                Book Treatment &rarr;
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
