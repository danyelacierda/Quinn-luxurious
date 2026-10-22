import { PageHero } from "@/components/shared/PageHero";
import { AppointmentsList } from "@/components/account/AppointmentsList";
import { SalonLocationCard } from "@/components/account/SalonLocationCard";
import { getUserAppointments, getCurrentUser } from "@/lib/supabase/queries";
import { SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";

import { redirect } from "next/navigation";
import Link from "next/link";
import { PlusCircle } from "lucide-react";

export default async function AccountPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/login?redirectTo=/account");
  }

  const [appointments, user, isAdmin] = await Promise.all([
    getUserAppointments(),
    getCurrentUser(),
    requireAdmin(),
  ]);

  return (
    <>
      <PageHero
        eyebrow={user ? `Welcome back, ${user.full_name.split(" ")[0]}` : "My Account"}
        title="My Appointments"
        description="View, reschedule, or cancel your appointments, or locate our studio."
      />

      <section className="section-padding bg-paper">
        <div className="container max-w-3xl space-y-10">
          {/* Header Action Bar */}
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Your Bookings ({appointments.length})
            </h2>
            <Button asChild size="sm" className="gap-1.5 shadow-gold">
              <Link href="/appointment">
                <PlusCircle className="h-4 w-4" /> Book Treatment
              </Link>
            </Button>
          </div>

          {/* Appointments List */}
          <AppointmentsList appointments={appointments} />

          {/* Salon Location & Directions */}
          <div className="pt-6">
            <div className="mb-4">
              <span className="eyebrow text-gold-dark">Find Us</span>
              <h3 className="font-display text-2xl font-semibold text-ink">
                Studio Location &amp; Directions
              </h3>
            </div>
            <SalonLocationCard />
          </div>

          {/* Account Actions */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4 border-t border-gold/15">
            {isAdmin && (
              <Button asChild variant="default" className="shadow-gold">
                <Link href="/admin">Admin Dashboard</Link>
              </Button>
            )}
            <SignOutButton>
              <Button variant="outline" className="border-gold/30 hover:bg-gold/10">
                Sign Out
              </Button>
            </SignOutButton>
          </div>
        </div>
      </section>
    </>
  );
}
