import Link from "next/link";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { ServiceCard } from "@/components/shared/ServiceCard";
import { Button } from "@/components/ui/button";
import { getFeaturedServices } from "@/lib/supabase/queries";
import { iconForCategory, formatServiceForCard } from "@/lib/serviceIcons";

export async function FeaturedServices() {
  const services = await getFeaturedServices(4);

  return (
    <section className="section-padding bg-cream">
      <div className="container">
        <SectionHeading
          eyebrow="What We Offer"
          title="Signature Services"
          description="Four of our most-loved treatments — each fully customized to you during a private consultation."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service, i) => {
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
        </div>

        <div className="mt-12 flex justify-center">
          <Button variant="outline" size="lg" asChild>
            <Link href="/services">See All Services</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
