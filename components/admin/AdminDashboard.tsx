"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  AppointmentWithDetails,
  ServiceRow,
  StaffWithStats,
  GalleryRow,
  PromotionRow,
  CustomerWithStats,
  InventoryItemWithDetails,
  ServiceRecipeWithDetails,
  InventoryMovementWithDetails,
} from "@/lib/supabase/queries";
import { AdminRevenueTab } from "@/components/admin/AdminRevenueTab";
import { AdminAppointmentsTab } from "@/components/admin/AdminAppointmentsTab";
import { AdminInventoryTab } from "@/components/admin/AdminInventoryTab";
import { AdminServicesTab } from "@/components/admin/AdminServicesTab";
import { AdminStaffTab } from "@/components/admin/AdminStaffTab";
import { AdminCustomersTab } from "@/components/admin/AdminCustomersTab";
import { AdminGalleryTab } from "@/components/admin/AdminGalleryTab";
import { AdminPromotionsTab } from "@/components/admin/AdminPromotionsTab";

type Props = {
  appointments: AppointmentWithDetails[];
  services: ServiceRow[];
  staff: StaffWithStats[];
  customers: CustomerWithStats[];
  gallery: GalleryRow[];
  promotions: PromotionRow[];
  inventoryItems?: InventoryItemWithDetails[];
  recipes?: ServiceRecipeWithDetails[];
  movements?: InventoryMovementWithDetails[];
};

export function AdminDashboard({
  appointments,
  services,
  staff,
  customers,
  gallery,
  promotions,
  inventoryItems = [],
  recipes = [],
  movements = [],
}: Props) {
  const tabs = [
    { id: "revenue", label: "Revenue & Analytics" },
    { id: "appointments", label: `Appointments (${appointments.length})` },
    { id: "inventory", label: `Inventory (${inventoryItems.length})` },
    { id: "staff", label: `Staff (${staff.length})` },
    { id: "services", label: `Services (${services.length})` },
    { id: "customers", label: `Customers (${customers.length})` },
    { id: "gallery", label: `Gallery (${gallery.length})` },
    { id: "promotions", label: `Promotions (${promotions.length})` },
  ] as const;

  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("revenue");

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-ink/10 pb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
              tab === t.id ? "bg-ink text-paper shadow-sm" : "bg-cream text-ink-soft hover:text-gold-dark hover:bg-cream/80"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "revenue" && <AdminRevenueTab appointments={appointments} />}
        {tab === "appointments" && <AdminAppointmentsTab appointments={appointments} staff={staff} />}
        {tab === "inventory" && (
          <AdminInventoryTab
            inventoryItems={inventoryItems}
            recipes={recipes}
            movements={movements}
            services={services}
          />
        )}
        {tab === "staff" && <AdminStaffTab staff={staff} />}
        {tab === "services" && <AdminServicesTab services={services} />}
        {tab === "customers" && <AdminCustomersTab customers={customers} />}
        {tab === "gallery" && <AdminGalleryTab gallery={gallery} />}
        {tab === "promotions" && <AdminPromotionsTab promotions={promotions} />}
      </div>
    </div>
  );
}
