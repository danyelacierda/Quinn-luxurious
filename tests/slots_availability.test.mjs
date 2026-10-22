import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  generateSlotsForDate,
  filterAvailableSlots,
  BOOKED_SLOTS_COLUMNS,
} from "../lib/businessHours.ts";

describe("Guest Slot Availability & RLS Bypass Suite", () => {
  // 2026-10-19 is a Monday (Open 9:00 AM - 7:00 PM)
  const mondayDate = new Date("2026-10-19T00:00:00");
  const allSlots = generateSlotsForDate(mondayDate, 60);

  test("a booked (non-cancelled) slot is excluded from returned availability", () => {
    assert.ok(allSlots.includes("10:00 AM"), "10:00 AM must be an initially available slot");

    const booked = [
      {
        appointment_time: "10:00 AM",
        appointment_date: "2026-10-19",
        staff_id: "staff-1",
        status: "confirmed",
      },
    ];

    const available = filterAvailableSlots(allSlots, booked, "staff-1");
    assert.equal(available.includes("10:00 AM"), false, "Booked slot must be excluded");
    assert.ok(available.includes("9:30 AM"), "Adjacent slot must remain available");
    assert.ok(available.includes("10:30 AM"), "Adjacent slot must remain available");
  });

  test("a cancelled appointment does NOT block its slot", () => {
    const booked = [
      {
        appointment_time: "10:00 AM",
        appointment_date: "2026-10-19",
        staff_id: "staff-1",
        status: "cancelled",
      },
    ];

    const available = filterAvailableSlots(allSlots, booked, "staff-1");
    assert.equal(available.includes("10:00 AM"), true, "Cancelled appointment must not block its slot");
  });

  test("the query selects only time/date/staff columns (no PII columns requested)", () => {
    const selectedColumns = BOOKED_SLOTS_COLUMNS.split(",").map((c) => c.trim());
    assert.deepEqual(selectedColumns, [
      "appointment_time",
      "appointment_date",
      "staff_id",
    ]);

    // Explicitly verify zero PII columns are selected
    const forbiddenPII = [
      "full_name",
      "email",
      "phone",
      "notes",
      "admin_notes",
      "customer_id",
      "payment_reference",
      "stripe_session_id",
      "stripe_payment_intent_id",
    ];

    for (const pii of forbiddenPII) {
      assert.equal(
        selectedColumns.includes(pii),
        false,
        `Query must NOT select PII column: ${pii}`
      );
    }
  });

  test("a different staff member's booking does not block this staff member's slot", () => {
    const booked = [
      {
        appointment_time: "10:00 AM",
        appointment_date: "2026-10-19",
        staff_id: "staff-2", // Booked with Staff 2
        status: "confirmed",
      },
    ];

    // Requesting availability for Staff 1: slot must remain free
    const availableForStaff1 = filterAvailableSlots(allSlots, booked, "staff-1");
    assert.equal(availableForStaff1.includes("10:00 AM"), true, "Staff 2 booking must not block Staff 1");

    // Requesting availability for Staff 2: slot must be taken
    const availableForStaff2 = filterAvailableSlots(allSlots, booked, "staff-2");
    assert.equal(availableForStaff2.includes("10:00 AM"), false, "Staff 2 booking must block Staff 2");
  });
});
