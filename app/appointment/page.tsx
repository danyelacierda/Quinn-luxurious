import { PageHero } from "@/components/shared/PageHero";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { getActiveServices, getActiveStaff, getCurrentUser } from "@/lib/supabase/queries";

type PageProps = {
  searchParams?: Promise<{ serviceId?: string }>;
};

export default async function AppointmentPage({ searchParams }: PageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const initialServiceId = typeof resolvedParams?.serviceId === "string" ? resolvedParams.serviceId : undefined;

  const [services, staff, user] = await Promise.all([
    getActiveServices(),
    getActiveStaff(),
    getCurrentUser(),
  ]);

  return (
    <>
      <PageHero
        eyebrow="Book a Visit"
        title="Book Your Appointment"
        description="Choose a service, pick a time that works for you, and you're set — no back-and-forth required."
      />

      <section className="section-padding bg-paper">
        <div className="container flex justify-center">
          <div className="w-full max-w-2xl">
            <BookingFlow
              services={services}
              staff={staff}
              defaultUser={user}
              initialServiceId={initialServiceId}
            />
          </div>
        </div>
      </section>
    </>
  );
}
