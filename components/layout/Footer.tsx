import Image from "next/image";
import Link from "next/link";
import { Sparkle, MapPin, Phone, Mail, Instagram, Facebook } from "lucide-react";
import { siteConfig, navLinks, businessHours, socialLinks } from "@/lib/data";

const socialIcons: Record<string, typeof Instagram> = {
  Instagram: Instagram,
  Facebook: Facebook,
  TikTok: Sparkle,
};

async function getLatestCommitDate() {
  try {
    const res = await fetch("https://api.github.com/repos/danyelacierda/Quinn-luxurious/commits/main", {
      next: { revalidate: 3600 }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return new Date(data.commit.author.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return null;
  }
}

export async function Footer() {
  const year = new Date().getFullYear();
  const commitDate = await getLatestCommitDate();

  return (
    <footer className="bg-ink text-ivory/90">
      <div className="container section-padding grid gap-12 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center">
              <Image src="/logo.jpg" alt="Quinn Luxurious Logo" width={40} height={40} className="rounded-sm object-cover" />
            </span>
            <span className="font-display text-xl font-semibold text-ivory pt-1">
              {siteConfig.name}
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ivory/60 max-w-xs">
            {siteConfig.description}
          </p>
          <div className="mt-6 flex gap-3">
            {socialLinks.map((s) => {
              const Icon = socialIcons[s.label] ?? Sparkle;
              return (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-ivory/15 text-ivory/70 transition-colors hover:border-gold hover:text-gold"
                >
                  <Icon className="h-4 w-4" />
                </a>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="eyebrow text-gold/80">Navigate</h4>
          <ul className="mt-4 space-y-2.5">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-ivory/70 hover:text-gold transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="eyebrow text-gold/80">Contact</h4>
          <ul className="mt-4 space-y-3 text-sm text-ivory/70">
            <li className="flex items-start gap-2.5">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gold" />
              <span>{siteConfig.address}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 shrink-0 text-gold" />
              <a href={`tel:${siteConfig.phone}`} className="hover:text-gold transition-colors">
                {siteConfig.phone}
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 shrink-0 text-gold" />
              <a href={`mailto:${siteConfig.email}`} className="hover:text-gold transition-colors">
                {siteConfig.email}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="eyebrow text-gold/80">Hours</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-ivory/70">
            {businessHours.map((b) => (
              <li key={b.day} className="flex justify-between gap-4">
                <span>{b.day}</span>
                <span className="text-ivory/50">{b.hours}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-ivory/10">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-2 py-6 text-xs text-ivory/50">
          <p>© {year} {siteConfig.name}. All rights reserved.</p>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center">
            {commitDate && <p>Last updated: {commitDate}</p>}
            <p>Crafted with care for beauty that lasts.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
