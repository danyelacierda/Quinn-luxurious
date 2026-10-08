"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type ServiceCardProps = {
  service: {
    title: string;
    description: string | null;
    duration: string;
    price: string;
  };
  icon: ReactNode;
  index?: number;
};

export function ServiceCard({ service, icon, index = 0 }: ServiceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
    >
      <Link href="/appointment" className="group block h-full">
        <Card className="h-full transition-all duration-300 hover:-translate-y-1.5 hover:shadow-gold hover:border-gold/30">
          <CardContent className="flex h-full flex-col p-7">
            <div className="flex items-center justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blush text-rose-dark transition-colors duration-300 group-hover:bg-gold/15 group-hover:text-gold-dark">
                {icon}
              </span>
              <ArrowUpRight className="h-5 w-5 text-ink/30 transition-all duration-300 group-hover:text-gold-dark group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>

            <h3 className="mt-5 font-display text-2xl font-semibold text-ink">
              {service.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft flex-1">
              {service.description}
            </p>

            <div className="mt-5 flex items-center justify-between border-t border-gold/10 pt-4 text-sm">
              <span className="text-ink-soft">{service.duration}</span>
              <span className="font-semibold text-gold-dark">{service.price}</span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
