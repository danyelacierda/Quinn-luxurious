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
  getAllInventoryItems,
  getServiceRecipes,
  getInventoryMovements,
} from "@/lib/supabase/queries";
import { requireAdmin } from "@/lib/auth";

export default async function AdminPage() {
  const isAdmin = await requireAdmin();
  if (!isAdmin) {
    redirect("/");
  }

  const [
    appointments,
    services,
    staff,
    customers,
    gallery,
    promotions,
    inventoryItems,
    recipes,
    movements,
  ] = await Promise.all([
    getAllAppointments(),
    getAllServices(),
    getAllStaff(),
    getCustomers(),
    getGalleryItems(),
    getAllPromotions(),
    getAllInventoryItems(),
    getServiceRecipes(),
    getInventoryMovements(),
  ]);

  return (
    <>
      <PageHero eyebrow="Staff Only" title="Admin Dashboard" description="Manage bookings, services, staff, inventory, and content." />

      <section className="section-padding bg-paper">
        <div className="container">
          <AdminDashboard
            appointments={appointments}
            services={services}
            staff={staff}
            customers={customers}
            gallery={gallery}
            promotions={promotions}
            inventoryItems={inventoryItems}
            recipes={recipes}
            movements={movements}
          />
        </div>
      </section>
    </>
  );
}
