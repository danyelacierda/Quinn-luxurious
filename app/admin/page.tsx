import { redirect } from "next/navigation";
import { PageHero } from "@/components/shared/PageHero";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import {
  getAllAppointments,
  getAllServices,
  getAllStaff,
  getCustomers,
  getGalleryItems,
  getAllPromotions,
  getCurrentUser,
} from "@/lib/supabase/queries";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "staff")) {
    redirect("/");
  }

  const [appointments, services, staff, customers, gallery, promotions] = await Promise.all([
    getAllAppointments(),
    getAllServices(),
    getAllStaff(),
    getCustomers(),
    getGalleryItems(),
    getAllPromotions(),
  ]);

  return (
    <>
      <PageHero eyebrow="Staff Only" title="Admin Dashboard" description="Manage bookings, services, staff, and content." />

      <section className="section-padding bg-paper">
        <div className="container">
          <AdminDashboard
            appointments={appointments}
            services={services}
            staff={staff}
            customers={customers}
            gallery={gallery}
            promotions={promotions}
          />
        </div>
      </section>
    </>
  );
}
