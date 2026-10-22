import { SectionHeading } from "@/components/shared/SectionHeading";
import { FeatureCard } from "@/components/shared/FeatureCard";
import { whyChooseUs } from "@/lib/data";

export function WhyChooseUs() {
  return (
    <section className="section-padding bg-paper">
      <div className="container">
        <SectionHeading
          eyebrow="Why Quinn Luxurious"
          title="Where Precision Meets Comfort"
          description="Every detail of your visit is considered — from the products on our shelves to the pace of your appointment."
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
  );
}
