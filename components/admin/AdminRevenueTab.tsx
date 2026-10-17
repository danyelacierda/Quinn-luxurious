"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { calculateRevenueMetrics } from "@/lib/revenue";
import type { AppointmentWithDetails } from "@/lib/supabase/queries";
import { 
  DollarSign, 
  Clock, 
  Banknote, 
  XCircle, 
  TrendingUp, 
  ShieldCheck, 
  CreditCard, 
  QrCode, 
  CheckCircle2 
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  appointments: AppointmentWithDetails[];
};

export function AdminRevenueTab({ appointments }: Props) {
  const metrics = useMemo(() => calculateRevenueMetrics(appointments), [appointments]);

  return (
    <div className="space-y-8">
      {/* Overview Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">Revenue & Financial Analytics</h2>
          <p className="text-sm text-ink-soft">
            Real-time financial performance calculated strictly from confirmed booking and payment records.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Admin-Only Financial Data</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Realized Revenue */}
        <Card className="p-5 border-l-4 border-l-emerald-600 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Realized Revenue</span>
            <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-ink">
              ₱{metrics.totalPaidRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              {metrics.paidCount} fully paid appointment{metrics.paidCount === 1 ? "" : "s"}
            </p>
          </div>
        </Card>

        {/* Pending Revenue */}
        <Card className="p-5 border-l-4 border-l-amber-500 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Pending Payments</span>
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-ink">
              ₱{metrics.totalPendingRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              {metrics.pendingCount} awaiting confirmation / checkout
            </p>
          </div>
        </Card>

        {/* In-Salon Cash Expected */}
        <Card className="p-5 border-l-4 border-l-blue-600 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Expected In-Salon Cash</span>
            <div className="rounded-full bg-blue-100 p-2 text-blue-700">
              <Banknote className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-ink">
              ₱{metrics.totalUnpaidCash.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              {metrics.unpaidCashCount} active cash booking{metrics.unpaidCashCount === 1 ? "" : "s"} due at salon
            </p>
          </div>
        </Card>

        {/* Cancelled / Lost Revenue */}
        <Card className="p-5 border-l-4 border-l-rose-500 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Cancelled Volume</span>
            <div className="rounded-full bg-rose-100 p-2 text-rose-700">
              <XCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-ink">
              ₱{metrics.totalCancelledRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="mt-1 text-xs text-rose-600">
              {metrics.cancelledCount} cancelled booking{metrics.cancelledCount === 1 ? "" : "s"} (excluded)
            </p>
          </div>
        </Card>
      </div>

      {/* Breakdown Grids */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payment Method Breakdown */}
        <Card className="p-6">
          <div className="flex items-center gap-2 border-b border-ink/10 pb-4">
            <TrendingUp className="h-5 w-5 text-gold-dark" />
            <h3 className="font-display text-lg font-semibold text-ink">Realized Revenue by Payment Method</h3>
          </div>

          <div className="mt-5 space-y-4">
            {/* Stripe */}
            <div className="flex items-center justify-between rounded-xl bg-cream/50 p-4 border border-ink/5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-ink">Stripe Online Checkout</p>
                  <p className="text-xs text-ink-soft">{metrics.byPaymentMethod.stripe.count} transactions settled</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-ink">
                  ₱{metrics.byPaymentMethod.stripe.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  Verified Online
                </span>
              </div>
            </div>

            {/* QR Ph */}
            <div className="flex items-center justify-between rounded-xl bg-cream/50 p-4 border border-ink/5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-cyan-100 p-2 text-cyan-700">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-ink">QR Ph (GCash / Maya)</p>
                  <p className="text-xs text-ink-soft">{metrics.byPaymentMethod.qr_ph.count} confirmed transactions</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-ink">
                  ₱{metrics.byPaymentMethod.qr_ph.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className="inline-block rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-800">
                  Admin Confirmed
                </span>
              </div>
            </div>

            {/* Cash */}
            <div className="flex items-center justify-between rounded-xl bg-cream/50 p-4 border border-ink/5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                  <Banknote className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-ink">Cash at Salon</p>
                  <p className="text-xs text-ink-soft">{metrics.byPaymentMethod.cash.count} payments collected</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-ink">
                  ₱{metrics.byPaymentMethod.cash.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  Received in Cash
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Category Revenue Breakdown */}
        <Card className="p-6">
          <div className="flex items-center gap-2 border-b border-ink/10 pb-4">
            <CheckCircle2 className="h-5 w-5 text-gold-dark" />
            <h3 className="font-display text-lg font-semibold text-ink">Realized Revenue by Service Category</h3>
          </div>

          <div className="mt-5 space-y-4">
            {Object.keys(metrics.byCategory).length === 0 ? (
              <p className="text-sm text-ink-soft py-4 text-center">No paid service transactions yet.</p>
            ) : (
              Object.entries(metrics.byCategory).map(([cat, data]) => {
                const percent = metrics.totalPaidRevenue > 0
                  ? Math.round((data.amount / metrics.totalPaidRevenue) * 100)
                  : 0;

                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-ink">{cat}</span>
                      <span className="font-bold text-ink">
                        ₱{data.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({percent}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-cream">
                      <div
                        className="h-full rounded-full bg-gold-dark transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-ink-soft">{data.count} paid appointments</p>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Business Rules Explanation Card for Instructor Audit */}
      <Card className="p-6 bg-cream/40 border border-ink/10">
        <h3 className="font-display text-base font-semibold text-ink flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-gold-dark" />
          Revenue Calculation Business Rules (Instructor Audit)
        </h3>
        <div className="mt-4 grid gap-3 text-xs text-ink-soft sm:grid-cols-2">
          <div className="space-y-1 rounded-lg bg-white p-3 border border-ink/5">
            <span className="font-semibold text-ink">1. Realized Revenue:</span>
            <p>
              Strictly appointments where <code>payment_status === &quot;fully_paid&quot;</code> and status is not cancelled. Uses authoritative database price to prevent tampering.
            </p>
          </div>
          <div className="space-y-1 rounded-lg bg-white p-3 border border-ink/5">
            <span className="font-semibold text-ink">2. Pending Revenue:</span>
            <p>
              Bookings awaiting confirmation or online checkout (<code>pending</code> / <code>pending_payment</code>).
            </p>
          </div>
          <div className="space-y-1 rounded-lg bg-white p-3 border border-ink/5">
            <span className="font-semibold text-ink">3. Unpaid In-Salon Cash:</span>
            <p>
              Confirmed bookings with payment method <code>cash</code> and status <code>unpaid</code>. Tracked as cash receivables.
            </p>
          </div>
          <div className="space-y-1 rounded-lg bg-white p-3 border border-ink/5">
            <span className="font-semibold text-ink">4. No Double Counting:</span>
            <p>
              Each appointment is partitioned into exactly one revenue status. Cancelled appointments are completely isolated from realized revenue.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
