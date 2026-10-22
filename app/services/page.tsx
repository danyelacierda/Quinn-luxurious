import { PageHero } from "@/components/shared/PageHero";
import { ServicesGrid } from "@/components/shared/ServicesGrid";
import { getActiveServices } from "@/lib/supabase/queries";

export default async function ServicesPage() {
  const services = await getActiveServices();

  return (
    <>
      <PageHero
        eyebrow="Our Menu"
        title="Services &amp; Pricing"
        description="Every treatment begins with a private consultation so your service is shaped around you. Prices reflect starting rates."
      />

      <section className="section-padding bg-paper">
        <div className="container">
          <ServicesGrid services={services} />
        </div>
      </section>
    </>
  );
}
