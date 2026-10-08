import { PageHero } from "@/components/shared/PageHero";
import { AppointmentsList } from "@/components/account/AppointmentsList";
import { getUserAppointments, getCurrentUser } from "@/lib/supabase/queries";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

import { redirect } from "next/navigation";
import Link from "next/link";

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

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            {(user?.role === "admin" || user?.role === "staff") && (
              <Button asChild variant="default">
                <Link href="/admin">Go to Admin Dashboard</Link>
              </Button>
            )}
            <SignOutButton>
              <Button variant="outline">Sign Out</Button>
            </SignOutButton>
          </div>
        </div>
      </section>
    </>
  );
}
