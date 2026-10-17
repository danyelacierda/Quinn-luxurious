import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { PageHero } from "@/components/shared/PageHero";
import { StaffBookingsList } from "@/components/staff/StaffBookingsList";
import { getStaffAppointments } from "@/lib/supabase/queries";
import { getCurrentUserRole } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { ShieldAlert, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Staff Work Portal — Quinn Luxurious",
  description: "View and manage assigned appointments and client schedules.",
};

export default async function StaffPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/staff");
  }

  const role = await getCurrentUserRole();
  const isAuthorized = role === "staff" || role === "admin";

  if (!isAuthorized) {
    return (
      <>
        <PageHero eyebrow="Staff Portal" title="Staff Access Required" description="You must be an authorized staff member to view this portal." />
        <section className="section-padding bg-paper">
          <div className="container max-w-lg">
            <Card className="p-8 text-center space-y-4">
              <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto" />
              <h2 className="font-display text-xl font-bold text-ink">Access Restricted</h2>
              <p className="text-sm text-ink-soft">
                Your account is currently registered as a customer. If you are a staff member, please request an invitation from the salon administrator or sign in with your staff account.
              </p>
              <Button asChild className="w-full">
                <Link href="/account">Go to Customer Account</Link>
              </Button>
            </Card>
          </div>
        </section>
      </>
    );
  }

  // Fetch staff profile and appointments strictly linked to this user's profile
  const { staff, appointments } = await getStaffAppointments();

  if (!staff) {
    return (
      <>
        <PageHero eyebrow="Staff Portal" title="Staff Profile Pending Link" description="Your account is authorized, but no staff profile is linked yet." />
        <section className="section-padding bg-paper">
          <div className="container max-w-lg">
            <Card className="p-8 text-center space-y-4">
              <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto" />
              <h2 className="font-display text-xl font-bold text-ink">Staff Profile Not Linked</h2>
              <p className="text-sm text-ink-soft">
                Your account has staff/admin privileges, but your user ID is not yet connected to a profile in the salon staff directory.
              </p>
              {role === "admin" ? (
                <Button asChild className="w-full">
                  <Link href="/admin">
                    Go to Admin Dashboard to Link Profile <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <p className="text-xs text-ink-soft italic">
                  Please ask your salon administrator to link your account to your staff record in the Admin dashboard.
                </p>
              )}
            </Card>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHero eyebrow="Staff Portal" title="Staff Schedule & Bookings" description="Manage your assigned appointments, clients, and service completions." />

      <section className="section-padding bg-paper">
        <div className="container">
          <StaffBookingsList staff={staff} appointments={appointments} />
        </div>
      </section>
    </>
  );
}
