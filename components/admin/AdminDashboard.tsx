"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  AppointmentWithDetails,
  ServiceRow,
  StaffRow,
  GalleryRow,
  PromotionRow,
  CustomerWithStats,
} from "@/lib/supabase/queries";
import { AdminAppointmentsTab } from "@/components/admin/AdminAppointmentsTab";
import { AdminServicesTab } from "@/components/admin/AdminServicesTab";
import { AdminStaffTab } from "@/components/admin/AdminStaffTab";
import { AdminCustomersTab } from "@/components/admin/AdminCustomersTab";
import { AdminGalleryTab } from "@/components/admin/AdminGalleryTab";
import { AdminPromotionsTab } from "@/components/admin/AdminPromotionsTab";

type Props = {
  appointments: AppointmentWithDetails[];
  services: ServiceRow[];
  staff: StaffRow[];
  customers: CustomerWithStats[];
  gallery: GalleryRow[];
  promotions: PromotionRow[];
};

export function AdminDashboard({ appointments, services, staff, customers, gallery, promotions }: Props) {
  const tabs = [
    { id: "appointments", label: `Appointments (${appointments.length})` },
    { id: "services", label: `Services (${services.length})` },
    { id: "staff", label: `Staff (${staff.length})` },
    { id: "customers", label: `Customers (${customers.length})` },
    { id: "gallery", label: `Gallery (${gallery.length})` },
    { id: "promotions", label: `Promotions (${promotions.length})` },
  ] as const;

  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("appointments");

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-ink/10 pb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
              tab === t.id ? "bg-ink text-paper" : "bg-cream text-ink-soft hover:text-gold-dark"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "appointments" && <AdminAppointmentsTab appointments={appointments} />}
        {tab === "services" && <AdminServicesTab services={services} />}
        {tab === "staff" && <AdminStaffTab staff={staff} />}
        {tab === "customers" && <AdminCustomersTab customers={customers} />}
        {tab === "gallery" && <AdminGalleryTab gallery={gallery} />}
        {tab === "promotions" && <AdminPromotionsTab promotions={promotions} />}
      </div>
    </div>
  );
}
