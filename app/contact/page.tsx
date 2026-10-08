import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import { ContactForm } from "@/components/shared/ContactForm";
import { siteConfig, businessHours } from "@/lib/data";

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Get In Touch"
        title="Contact Us"
        description="Questions about a service, or ready to book? We'd love to hear from you."
      />

      <section className="section-padding bg-paper">
        <div className="container grid gap-12 md:grid-cols-[0.9fr,1.1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl bg-cream p-7">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 mt-0.5 text-gold-dark shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-ink">Studio Address</p>
                  <p className="text-sm text-ink-soft mt-1">{siteConfig.address}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-cream p-7">
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 mt-0.5 text-gold-dark shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-ink">Phone</p>
                  <a href={`tel:${siteConfig.phone}`} className="text-sm text-ink-soft mt-1 hover:text-gold-dark">
                    {siteConfig.phone}
                  </a>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-cream p-7">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 mt-0.5 text-gold-dark shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-ink">Email</p>
                  <a href={`mailto:${siteConfig.email}`} className="text-sm text-ink-soft mt-1 hover:text-gold-dark">
                    {siteConfig.email}
                  </a>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-cream p-7">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 mt-0.5 text-gold-dark shrink-0" />
                <div className="w-full">
                  <p className="text-sm font-semibold text-ink">Business Hours</p>
                  <ul className="mt-2 space-y-1.5">
                    {businessHours.map((b) => (
                      <li key={b.day} className="flex justify-between text-sm text-ink-soft">
                        <span>{b.day}</span>
                        <span>{b.hours}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <ContactForm />
        </div>
      </section>
    </>
  );
}
