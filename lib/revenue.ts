/**
 * Quinn Luxurious — Revenue Calculation Engine
 * 
 * BUSINESS RULES FOR REVENUE CALCULATIONS:
 * 1. REALIZED / PAID REVENUE:
 *    - Strict condition: payment_status === 'fully_paid' AND status !== 'cancelled'
 *    - Source of truth: balance_paid if recorded > 0, otherwise authoritative service price (services.price).
 *    - Captures successfully settled Stripe charges, admin-verified QR Ph payments, and admin-recorded Cash receipts.
 * 
 * 2. PENDING PAYMENTS:
 *    - Strict condition: payment_status in ('pending', 'pending_payment') AND status !== 'cancelled'
 *    - Value: services.price
 *    - Captures customer bookings awaiting payment confirmation (e.g. pending QR Ph receipt or open Stripe checkout).
 * 
 * 3. UNPAID IN-SALON CASH:
 *    - Strict condition: payment_method === 'cash' AND payment_status === 'unpaid' AND status in ('confirmed', 'completed')
 *    - Value: services.price
 *    - Represents booked customers who will settle balance directly at the salon upon arrival.
 * 
 * 4. CANCELLED / LOST REVENUE:
 *    - Strict condition: status === 'cancelled'
 *    - Value: services.price
 *    - Excluded from all active revenue totals to prevent inflation. Tracked independently for audit and business insights.
 * 
 * 5. NO DOUBLE COUNTING GUARANTEE:
 *    - Every appointment is partitioned into exactly one primary revenue status bucket using strict precedence:
 *      A. Cancelled -> Lost Revenue
 *      B. fully_paid -> Realized Revenue
 *      C. pending / pending_payment -> Pending Revenue
 *      D. cash && unpaid -> Unpaid In-Salon Cash
 *      E. other -> Non-revenue / Draft
 */

export interface AppointmentRevenueRecord {
  id: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  balance_paid?: number | null;
  services?: {
    name?: string;
    category?: string;
    price?: number;
  } | null;
  appointment_date?: string;
}

export interface RevenueMetrics {
  // Primary KPI metrics
  totalPaidRevenue: number;
  totalPendingRevenue: number;
  totalUnpaidCash: number;
  totalCancelledRevenue: number;

  // Counts
  totalAppointments: number;
  paidCount: number;
  pendingCount: number;
  unpaidCashCount: number;
  cancelledCount: number;
  completedCount: number;
  confirmedCount: number;

  // Breakdowns
  byPaymentMethod: {
    stripe: { count: number; amount: number };
    qr_ph: { count: number; amount: number };
    cash: { count: number; amount: number };
    unspecified: { count: number; amount: number };
  };

  byCategory: Record<string, { count: number; amount: number }>;
}

export function calculateRevenueMetrics(
  appointments: AppointmentRevenueRecord[]
): RevenueMetrics {
  let totalPaidRevenue = 0;
  let totalPendingRevenue = 0;
  let totalUnpaidCash = 0;
  let totalCancelledRevenue = 0;

  let paidCount = 0;
  let pendingCount = 0;
  let unpaidCashCount = 0;
  let cancelledCount = 0;
  let completedCount = 0;
  let confirmedCount = 0;

  const byPaymentMethod = {
    stripe: { count: 0, amount: 0 },
    qr_ph: { count: 0, amount: 0 },
    cash: { count: 0, amount: 0 },
    unspecified: { count: 0, amount: 0 },
  };

  const byCategory: Record<string, { count: number; amount: number }> = {};

  for (const appt of appointments) {
    const rawPrice = Number(appt.services?.price ?? 0);
    const price = isNaN(rawPrice) || rawPrice < 0 ? 0 : rawPrice;
    const balancePaid = Number(appt.balance_paid ?? 0);
    const paidAmount = balancePaid > 0 ? balancePaid : price;

    const status = (appt.status ?? "").toLowerCase();
    const paymentStatus = (appt.payment_status ?? "").toLowerCase();
    const paymentMethod = (appt.payment_method ?? "").toLowerCase();
    const category = appt.services?.category ?? "General";

    // Track status counts
    if (status === "completed") completedCount++;
    if (status === "confirmed") confirmedCount++;

    // Partition into exactly ONE primary revenue bucket (NO double counting)
    if (status === "cancelled") {
      cancelledCount++;
      totalCancelledRevenue += price;
      // Do not add to realized, pending, or method totals
      continue;
    }

    if (paymentStatus === "fully_paid") {
      paidCount++;
      totalPaidRevenue += paidAmount;

      // Method breakdown for realized revenue
      if (paymentMethod === "stripe") {
        byPaymentMethod.stripe.count++;
        byPaymentMethod.stripe.amount += paidAmount;
      } else if (paymentMethod === "qr_ph") {
        byPaymentMethod.qr_ph.count++;
        byPaymentMethod.qr_ph.amount += paidAmount;
      } else if (paymentMethod === "cash") {
        byPaymentMethod.cash.count++;
        byPaymentMethod.cash.amount += paidAmount;
      } else {
        byPaymentMethod.unspecified.count++;
        byPaymentMethod.unspecified.amount += paidAmount;
      }

      // Category breakdown for realized revenue
      if (!byCategory[category]) {
        byCategory[category] = { count: 0, amount: 0 };
      }
      byCategory[category].count++;
      byCategory[category].amount += paidAmount;
    } else if (paymentStatus === "pending" || paymentStatus === "pending_payment") {
      pendingCount++;
      totalPendingRevenue += price;
    } else if (paymentMethod === "cash" && paymentStatus === "unpaid" && (status === "confirmed" || status === "completed")) {
      unpaidCashCount++;
      totalUnpaidCash += price;
    }
  }

  return {
    totalPaidRevenue,
    totalPendingRevenue,
    totalUnpaidCash,
    totalCancelledRevenue,
    totalAppointments: appointments.length,
    paidCount,
    pendingCount,
    unpaidCashCount,
    cancelledCount,
    completedCount,
    confirmedCount,
    byPaymentMethod,
    byCategory,
  };
}
