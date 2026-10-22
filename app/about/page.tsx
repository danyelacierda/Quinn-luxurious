import Image from "next/image";
import { PageHero } from "@/components/shared/PageHero";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { FeatureCard } from "@/components/shared/FeatureCard";
import { whyChooseUs } from "@/lib/data";
import { Sparkle } from "lucide-react";

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="Our Story"
        title="About Quinn Luxurious"
        description="A boutique studio built on the belief that beauty appointments should feel like a pause, not a chore."
      />

      <section className="section-padding bg-paper">
        <div className="container grid gap-16 md:grid-cols-2 md:items-center">
          <div className="relative aspect-square overflow-hidden rounded-4xl shadow-card">
            <Image
              src="/gallery/studio_interior.jpg"
              alt="Quinn Luxurious Studio Interior"
              fill
              className="object-cover"
            />
            <div className="absolute inset-10 rounded-full border border-ivory/20" />
          </div>

          <div>
            <span className="eyebrow">Since 2018</span>
            <h2 className="mt-4 font-display text-3xl md:text-4xl font-semibold text-ink text-balance">
              Founded on Patience, Precision, and a Love of Detail
            </h2>
            <p className="mt-5 text-ink-soft leading-relaxed">
              Quinn Luxurious began as a single lash chair in a shared studio and grew, one
              referral at a time, into a full lash and nail destination. Our founder, Quinn,
              believed the best results came from slowing down — longer appointments, better
              products, and technicians who treat every set as their own signature work.
            </p>
            <p className="mt-4 text-ink-soft leading-relaxed">
              Today, our team of certified artists carries that same philosophy into every
              appointment: consultation first, comfort throughout, and a finish that holds up
              long after you leave the chair.
            </p>
          </div>
        </div>
      </section>

      <section className="section-padding bg-cream">
        <div className="container">
          <SectionHeading
            eyebrow="Our Values"
            title="What Guides Every Appointment"
          />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {whyChooseUs.map(({ icon: Icon, ...item }, i) => (
              <FeatureCard
                key={item.title}
                {...item}
                icon={<Icon className="h-6 w-6" strokeWidth={1.75} />}
                index={i}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
