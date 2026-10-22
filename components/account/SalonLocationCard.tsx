"use client";

import { MapPin, Phone, Mail, Clock, Navigation, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { siteConfig, businessHours } from "@/lib/data";

export function SalonLocationCard() {
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteConfig.address)}`;

  return (
    <Card className="overflow-hidden rounded-3xl border-gold/25 bg-white shadow-card">
      <div className="grid md:grid-cols-5">
        {/* Visual Map Representation / Directions Callout */}
        <div className="relative flex flex-col justify-between bg-ink p-7 text-paper md:col-span-2">
          {/* Subtle geometric pattern overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(#B6874F_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />

          <div className="relative z-10">
            <span className="eyebrow text-gold-light">Studio Location</span>
            <h3 className="mt-2 font-display text-2xl font-semibold text-paper">
              {siteConfig.name}
            </h3>
            <p className="mt-1 text-xs text-paper/70">
              {siteConfig.tagline}
            </p>

            <div className="mt-6 flex items-start gap-3 text-sm leading-relaxed text-paper/90">
              <MapPin className="h-5 w-5 shrink-0 text-gold-light mt-0.5" />
              <span>{siteConfig.address}</span>
            </div>
          </div>

          <div className="relative z-10 mt-8 pt-6 border-t border-paper/10 flex flex-col gap-2.5">
            <Button
              asChild
              className="w-full gap-2 bg-gold hover:bg-gold-dark text-white shadow-gold"
            >
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                <Navigation className="h-4 w-4" />
                Get Driving Directions
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full border-paper/20 bg-transparent text-paper hover:bg-paper/10 hover:text-white"
            >
              <a href={`tel:${siteConfig.phone.replace(/[^0-9+]/g, "")}`}>
                <Phone className="h-4 w-4 mr-2" />
                Call Salon Desk
              </a>
            </Button>
          </div>
        </div>

        {/* Operating Hours & Contact Details */}
        <div className="p-7 md:col-span-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-gold/15">
              <Clock className="h-4 w-4 text-gold-dark" />
              <h4 className="font-display text-lg font-semibold text-ink">
                Salon Business Hours
              </h4>
            </div>

            <div className="mt-4 space-y-3">
              {businessHours.map((bh) => (
                <div key={bh.day} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{bh.day}</span>
                  <span className="text-ink-soft">{bh.hours}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gold/15 grid sm:grid-cols-2 gap-4 text-xs text-ink-soft">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gold-dark shrink-0" />
              <span className="font-medium text-ink">{siteConfig.phone}</span>
            </div>
            <div className="flex items-center gap-2 truncate">
              <Mail className="h-4 w-4 text-gold-dark shrink-0" />
              <span className="font-medium text-ink truncate">{siteConfig.email}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
