import { SectionHeading } from "@/components/shared/SectionHeading";
import { TestimonialCard } from "@/components/shared/TestimonialCard";
import { getReviews } from "@/lib/supabase/queries";

export async function Testimonials() {
  const reviews = await getReviews(6);

  if (reviews.length === 0) return null;

  return (
    <section className="section-padding bg-blush/40">
      <div className="container">
        <SectionHeading eyebrow="Client Love" title="Kind Words From Our Clients" />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {reviews.map((r, i) => (
            <TestimonialCard key={r.id} name={r.full_name} quote={r.review_text} rating={r.rating} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
