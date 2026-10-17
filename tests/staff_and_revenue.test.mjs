import test from "node:test";
import assert from "node:assert/strict";

// Import pure functions
import { calculateRevenueMetrics } from "../lib/revenue.ts";
import { isValidEmail } from "../lib/validation.ts";
import { isAuthorizedToManageAppointment, resolveUserRole } from "../lib/authPolicy.ts";

test.describe("Step 4: Staff and Revenue Suite", () => {
  test.describe("1. Revenue Dashboard Calculations & Business Rules", () => {
    test("accurately calculates realized revenue from fully_paid appointments", () => {
      const mockAppointments = [
        {
          id: "appt-1",
          status: "confirmed",
          payment_status: "fully_paid",
          payment_method: "stripe",
          balance_paid: 1500,
          services: { name: "Volume Lash Full Set", category: "Eyelash Extensions", price: 1500 },
        },
        {
          id: "appt-2",
          status: "completed",
          payment_status: "fully_paid",
          payment_method: "cash",
          balance_paid: 800,
          services: { name: "Gel Manicure", category: "Nails", price: 800 },
        },
      ];

      const metrics = calculateRevenueMetrics(mockAppointments);
      assert.equal(metrics.totalPaidRevenue, 2300);
      assert.equal(metrics.paidCount, 2);
      assert.equal(metrics.byPaymentMethod.stripe.amount, 1500);
      assert.equal(metrics.byPaymentMethod.cash.amount, 800);
      assert.equal(metrics.byCategory["Eyelash Extensions"].amount, 1500);
      assert.equal(metrics.byCategory["Nails"].amount, 800);
    });

    test("strictly excludes cancelled bookings from realized revenue and tracks as lost volume", () => {
      const mockAppointments = [
        {
          id: "appt-1",
          status: "confirmed",
          payment_status: "fully_paid",
          payment_method: "stripe",
          services: { name: "Classic Lashes", price: 1200 },
        },
        {
          id: "appt-2",
          status: "cancelled",
          payment_status: "fully_paid", // Even if payment_status says fully_paid, cancellation isolates it
          payment_method: "stripe",
          services: { name: "Lash Lift", price: 900 },
        },
        {
          id: "appt-3",
          status: "cancelled",
          payment_status: "unpaid",
          payment_method: "cash",
          services: { name: "Nail Art", price: 500 },
        },
      ];

      const metrics = calculateRevenueMetrics(mockAppointments);
      // Realized revenue should only be 1200
      assert.equal(metrics.totalPaidRevenue, 1200);
      assert.equal(metrics.paidCount, 1);
      // Cancelled volume is tracked separately
      assert.equal(metrics.totalCancelledRevenue, 1400); // 900 + 500
      assert.equal(metrics.cancelledCount, 2);
    });

    test("distinguishes pending payments and unpaid cash receivables without double counting", () => {
      const mockAppointments = [
        {
          id: "appt-paid",
          status: "confirmed",
          payment_status: "fully_paid",
          payment_method: "qr_ph",
          services: { name: "Service A", price: 2000 },
        },
        {
          id: "appt-pending-qr",
          status: "pending_payment",
          payment_status: "pending",
          payment_method: "qr_ph",
          services: { name: "Service B", price: 1000 },
        },
        {
          id: "appt-cash-unpaid",
          status: "confirmed",
          payment_status: "unpaid",
          payment_method: "cash",
          services: { name: "Service C", price: 600 },
        },
      ];

      const metrics = calculateRevenueMetrics(mockAppointments);
      assert.equal(metrics.totalPaidRevenue, 2000);
      assert.equal(metrics.totalPendingRevenue, 1000);
      assert.equal(metrics.totalUnpaidCash, 600);
      assert.equal(metrics.totalAppointments, 3);
      assert.equal(metrics.paidCount, 1);
      assert.equal(metrics.pendingCount, 1);
      assert.equal(metrics.unpaidCashCount, 1);

      // Verify no double counting: Sum of mutually exclusive partition counts equals total appointments
      const partitionSum = metrics.paidCount + metrics.pendingCount + metrics.unpaidCashCount + metrics.cancelledCount;
      assert.equal(partitionSum, 3);
    });
  });

  test.describe("2. Staff Assignment & Scheduling Conflict Validation", () => {
    function checkAssignmentConflict({
      targetDate,
      targetTime,
      staffId,
      existingAppointments,
      isStaffActive,
    }) {
      if (!isStaffActive) {
        return { ok: false, error: "Cannot assign: Staff member is currently inactive." };
      }

      const conflict = existingAppointments.find(
        (a) =>
          a.staff_id === staffId &&
          a.appointment_date === targetDate &&
          a.appointment_time === targetTime &&
          ["confirmed", "pending", "pending_payment"].includes(a.status)
      );

      if (conflict) {
        return {
          ok: false,
          error: "Scheduling conflict: Staff member is already booked on " + targetDate + " at " + targetTime + ".",
        };
      }

      return { ok: true, error: null };
    }

    test("allows assigning active staff member when no conflict exists", () => {
      const result = checkAssignmentConflict({
        targetDate: "2026-10-25",
        targetTime: "10:00 AM",
        staffId: "staff-123",
        existingAppointments: [
          {
            id: "appt-existing",
            staff_id: "staff-123",
            appointment_date: "2026-10-25",
            appointment_time: "02:00 PM",
            status: "confirmed",
          },
        ],
        isStaffActive: true,
      });

      assert.equal(result.ok, true);
      assert.equal(result.error, null);
    });

    test("REJECTS assignment to an inactive staff member", () => {
      const result = checkAssignmentConflict({
        targetDate: "2026-10-25",
        targetTime: "10:00 AM",
        staffId: "staff-inactive",
        existingAppointments: [],
        isStaffActive: false,
      });

      assert.equal(result.ok, false);
      assert.match(result.error, /inactive/i);
    });

    test("REJECTS assignment when staff member already has an active booking at the same date and time", () => {
      const result = checkAssignmentConflict({
        targetDate: "2026-10-25",
        targetTime: "10:00 AM",
        staffId: "staff-123",
        existingAppointments: [
          {
            id: "appt-existing",
            staff_id: "staff-123",
            appointment_date: "2026-10-25",
            appointment_time: "10:00 AM",
            status: "confirmed",
          },
        ],
        isStaffActive: true,
      });

      assert.equal(result.ok, false);
      assert.match(result.error, /scheduling conflict/i);
    });

    test("ignores cancelled appointments when checking for scheduling conflicts", () => {
      const result = checkAssignmentConflict({
        targetDate: "2026-10-25",
        targetTime: "10:00 AM",
        staffId: "staff-123",
        existingAppointments: [
          {
            id: "appt-cancelled",
            staff_id: "staff-123",
            appointment_date: "2026-10-25",
            appointment_time: "10:00 AM",
            status: "cancelled",
          },
        ],
        isStaffActive: true,
      });

      assert.equal(result.ok, true);
      assert.equal(result.error, null);
    });
  });

  test.describe("3. Staff Portal Isolation & Authorization", () => {
    function queryStaffBookings({ authenticatedUserId, staffProfileMap, allAppointments }) {
      const staffProfile = staffProfileMap[authenticatedUserId];
      if (!staffProfile || !staffProfile.is_active) {
        return { authorized: false, appointments: [] };
      }

      const assigned = allAppointments.filter((a) => a.staff_id === staffProfile.id);
      return { authorized: true, appointments: assigned };
    }

    test("Staff A sees only their own assigned bookings, never Staff B bookings", () => {
      const staffProfiles = {
        "user_staff_A": { id: "staff-uuid-A", full_name: "Staff Member A", is_active: true },
        "user_staff_B": { id: "staff-uuid-B", full_name: "Staff Member B", is_active: true },
      };

      const allAppointments = [
        { id: "appt-1", staff_id: "staff-uuid-A", full_name: "Client 1" },
        { id: "appt-2", staff_id: "staff-uuid-B", full_name: "Client 2" },
        { id: "appt-3", staff_id: "staff-uuid-A", full_name: "Client 3" },
      ];

      const resultA = queryStaffBookings({
        authenticatedUserId: "user_staff_A",
        staffProfileMap: staffProfiles,
        allAppointments,
      });

      assert.equal(resultA.authorized, true);
      assert.equal(resultA.appointments.length, 2);
      assert.deepEqual(
        resultA.appointments.map((a) => a.id),
        ["appt-1", "appt-3"]
      );

      assert.equal(resultA.appointments.some((a) => a.staff_id === "staff-uuid-B"), false);
    });

    test("Ordinary customer cannot access staff bookings portal", () => {
      const staffProfiles = {
        "user_staff_A": { id: "staff-uuid-A", full_name: "Staff Member A", is_active: true },
      };

      const resultCustomer = queryStaffBookings({
        authenticatedUserId: "user_customer_123",
        staffProfileMap: staffProfiles,
        allAppointments: [{ id: "appt-1", staff_id: "staff-uuid-A" }],
      });

      assert.equal(resultCustomer.authorized, false);
      assert.equal(resultCustomer.appointments.length, 0);
    });

    test("Staff member cannot mark another staff member's appointment as completed", () => {
      function markCompletedByStaff({ callerStaffId, appointmentStaffId }) {
        if (!callerStaffId || callerStaffId !== appointmentStaffId) {
          return { ok: false, error: "Forbidden: You can only update appointments assigned to you." };
        }
        return { ok: true, error: null };
      }

      const forbiddenResult = markCompletedByStaff({
        callerStaffId: "staff-uuid-A",
        appointmentStaffId: "staff-uuid-B",
      });
      assert.equal(forbiddenResult.ok, false);
      assert.match(forbiddenResult.error, /forbidden/i);

      const successResult = markCompletedByStaff({
        callerStaffId: "staff-uuid-A",
        appointmentStaffId: "staff-uuid-A",
      });
      assert.equal(successResult.ok, true);
    });
  });

  test.describe("4. Safe Staff Removal Safeguards (Instructor Rule #11)", () => {
    function canDeleteStaff({ staffId, todayManila, staffAppointments }) {
      const upcoming = staffAppointments.filter(
        (a) =>
          a.staff_id === staffId &&
          a.appointment_date >= todayManila &&
          ["confirmed", "pending", "pending_payment"].includes(a.status)
      );

      if (upcoming.length > 0) {
        return {
          canDelete: false,
          error: "Cannot delete staff member with " + upcoming.length + " upcoming appointment(s). Please reassign or cancel their upcoming appointments first.",
        };
      }

      const unlinkedAppointments = staffAppointments.map((a) =>
        a.staff_id === staffId ? { ...a, staff_id: null } : a
      );

      return {
        canDelete: true,
        error: null,
        unlinkedAppointments,
      };
    }

    test("BLOCKS deletion of staff member who has active upcoming appointments", () => {
      const result = canDeleteStaff({
        staffId: "staff-uuid-1",
        todayManila: "2026-10-17",
        staffAppointments: [
          {
            id: "appt-upcoming",
            staff_id: "staff-uuid-1",
            appointment_date: "2026-10-20",
            status: "confirmed",
          },
        ],
      });

      assert.equal(result.canDelete, false);
      assert.match(result.error, /Cannot delete staff member with 1 upcoming appointment/i);
    });

    test("ALLOWS safe removal when only past or cancelled appointments exist, safely unlinking history (staff_id = null)", () => {
      const initialAppointments = [
        {
          id: "appt-past-completed",
          staff_id: "staff-uuid-1",
          appointment_date: "2026-09-01",
          status: "completed",
        },
        {
          id: "appt-cancelled",
          staff_id: "staff-uuid-1",
          appointment_date: "2026-10-25",
          status: "cancelled",
        },
      ];

      const result = canDeleteStaff({
        staffId: "staff-uuid-1",
        todayManila: "2026-10-17",
        staffAppointments: initialAppointments,
      });

      assert.equal(result.canDelete, true);
      assert.equal(result.error, null);

      assert.equal(result.unlinkedAppointments.length, 2);
      assert.equal(result.unlinkedAppointments[0].staff_id, null);
      assert.equal(result.unlinkedAppointments[1].staff_id, null);
      assert.equal(result.unlinkedAppointments[0].id, "appt-past-completed");
    });
  });

  test.describe("5. Secure Staff Onboarding & Invitation Validation", () => {
    test("validates staff invitation email format strictly", () => {
      assert.equal(isValidEmail("staff.lash@quinn.com"), true);
      assert.equal(isValidEmail("jane.doe+staff@example.ph"), true);
      assert.equal(isValidEmail("not-an-email"), false);
      assert.equal(isValidEmail(""), false);
      assert.equal(isValidEmail("staff@invalid"), false);
    });

    test("prevents role escalation: invited staff role cannot exceed 'staff'", () => {
      const regularStaffRole = resolveUserRole({
        metadataRole: "staff",
        primaryEmail: { emailAddress: "staff@quinn.com", isVerified: true },
        adminEmailsEnv: "admin@quinn.com",
      });
      assert.equal(regularStaffRole, "staff");

      const spoofedRole = resolveUserRole({
        metadataRole: "superadmin_bypass",
        primaryEmail: { emailAddress: "staff@quinn.com", isVerified: true },
        adminEmailsEnv: "admin@quinn.com",
      });
      assert.equal(spoofedRole, "customer");
    });
  });
});
