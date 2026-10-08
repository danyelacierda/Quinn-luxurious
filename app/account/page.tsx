import { PageHero } from "@/components/shared/PageHero";
import { AppointmentsList } from "@/components/account/AppointmentsList";
import { getUserAppointments, getCurrentUser } from "@/lib/supabase/queries";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export default async function AccountPage() {
  const [appointments, user] = await Promise.all([getUserAppointments(), getCurrentUser()]);

  return (
    <>
      <PageHero
        eyebrow={user ? `Hi, ${user.full_name.split(" ")[0]}` : "My Account"}
        title="My Appointments"
        description="View, reschedule, or cancel your upcoming visits."
      />

      <section className="section-padding bg-paper">
        <div className="container max-w-3xl">
          <AppointmentsList appointments={appointments} />

          <form action={signOut} className="mt-12 text-center">
            <Button type="submit" variant="outline">
              Sign Out
            </Button>
          </form>
        </div>
      </section>
    </>
  );
}
