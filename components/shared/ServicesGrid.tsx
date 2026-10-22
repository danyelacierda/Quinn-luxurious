"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ServiceCard } from "@/components/shared/ServiceCard";
import { iconForCategory, formatServiceForCard } from "@/lib/serviceIcons";
import type { ServiceRow } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";

const categories = ["All", "Eyelash Extensions", "Lash Lift", "Nails"] as const;

export function ServicesGrid({ services }: { services: ServiceRow[] }) {
  const [active, setActive] = useState<(typeof categories)[number]>("All");

  const filtered = active === "All" ? services : services.filter((s) => s.category === active);

  return (
    <>
      <div className="flex flex-wrap justify-center gap-3">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActive(cat)}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-semibold tracking-wide transition-all duration-300",
              active === cat ? "bg-gold text-ivory shadow-gold" : "bg-cream text-ink-soft hover:text-gold-dark"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <motion.div layout className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((service, i) => {
          const Icon = iconForCategory(service.category);
          return (
            <ServiceCard
              key={service.id}
              service={formatServiceForCard(service)}
              icon={<Icon className="h-6 w-6" strokeWidth={1.75} />}
              index={i}
            />
          );
        })}
      </motion.div>

      {filtered.length === 0 && (
        <p className="mt-12 text-center text-ink-soft">No services in this category yet.</p>
      )}
    </>
  );
}
