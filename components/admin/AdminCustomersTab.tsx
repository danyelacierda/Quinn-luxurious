import { Card } from "@/components/ui/card";
import type { CustomerWithStats } from "@/lib/supabase/queries";

export function AdminCustomersTab({ customers }: { customers: CustomerWithStats[] }) {
  if (customers.length === 0) {
    return <Card className="p-8 text-center text-ink-soft">No customers yet.</Card>;
  }

  return (
    <div className="space-y-3">
      {customers.map((c) => (
        <Card key={c.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-display text-base font-semibold text-ink">{c.full_name}</p>
            <p className="text-sm text-ink-soft">
              {c.email} {c.phone ? `· ${c.phone}` : ""}
            </p>
          </div>
          <span className="rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-gold-dark">
            {c.appointment_count} {c.appointment_count === 1 ? "appointment" : "appointments"}
          </span>
        </Card>
      ))}
    </div>
  );
}
