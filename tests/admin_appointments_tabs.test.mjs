import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseTimeToMinutes,
  filterAppointmentsByTab,
  getAppointmentTabCounts,
  sortAppointmentsForTab,
  formatDateHeader,
  groupAppointmentsByDate,
  getTabAppointmentsGroupedByDate,
} from "../lib/appointments/admin-tabs.ts";

describe("Admin Appointments Tabs & Sorting Suite", () => {
  describe("1. Pure Time-to-Minutes Parser (parseTimeToMinutes)", () => {
    test("accurately parses standard 24-hour formats into minutes since midnight", () => {
      assert.equal(parseTimeToMinutes("00:00"), 0);
      assert.equal(parseTimeToMinutes("09:00"), 540);
      assert.equal(parseTimeToMinutes("11:00"), 660);
      assert.equal(parseTimeToMinutes("14:30"), 870);
      assert.equal(parseTimeToMinutes("17:45"), 1065);
      assert.equal(parseTimeToMinutes("23:59"), 1439);
    });

    test("accurately parses standard 12-hour formats into minutes since midnight", () => {
      assert.equal(parseTimeToMinutes("12:00 AM"), 0);
      assert.equal(parseTimeToMinutes("12:30 AM"), 30);
      assert.equal(parseTimeToMinutes("9:00 AM"), 540);
      assert.equal(parseTimeToMinutes("11:00 AM"), 660);
      assert.equal(parseTimeToMinutes("12:00 PM"), 720);
      assert.equal(parseTimeToMinutes("12:15 PM"), 735);
      assert.equal(parseTimeToMinutes("3:30 PM"), 930);
      assert.equal(parseTimeToMinutes("11:59 PM"), 1439);
    });

    test("handles lowercase am/pm, whitespace variations, and malformed inputs gracefully", () => {
      assert.equal(parseTimeToMinutes("  3:30 pm  "), 930);
      assert.equal(parseTimeToMinutes("11:00 am"), 660);
      assert.equal(parseTimeToMinutes(""), 0);
      assert.equal(parseTimeToMinutes(null), 0);
      assert.equal(parseTimeToMinutes(undefined), 0);
      assert.equal(parseTimeToMinutes("invalid-time"), 0);
    });
  });

  describe("2. Tab Filtering & Status Segregation", () => {
    const appointments = [
      { id: "appt-1", status: "pending" },
      { id: "appt-2", status: "pending_payment" },
      { id: "appt-3", status: "confirmed" },
      { id: "appt-4", status: "completed" },
      { id: "appt-5", status: "completed" },
      { id: "appt-6", status: "cancelled" },
    ];

    test("Upcoming tab strictly captures pending, pending_payment, and confirmed bookings", () => {
      const upcoming = filterAppointmentsByTab(appointments, "upcoming");
      const ids = upcoming.map((a) => a.id);
      assert.deepEqual(ids, ["appt-1", "appt-2", "appt-3"]);
    });

    test("Completed tab strictly captures completed bookings", () => {
      const completed = filterAppointmentsByTab(appointments, "completed");
      const ids = completed.map((a) => a.id);
      assert.deepEqual(ids, ["appt-4", "appt-5"]);
    });

    test("Cancelled tab strictly captures cancelled bookings", () => {
      const cancelled = filterAppointmentsByTab(appointments, "cancelled");
      const ids = cancelled.map((a) => a.id);
      assert.deepEqual(ids, ["appt-6"]);
    });

    test("getAppointmentTabCounts calculates live badge totals accurately", () => {
      const counts = getAppointmentTabCounts(appointments);
      assert.deepEqual(counts, {
        upcoming: 3,
        completed: 2,
        cancelled: 1,
      });
    });
  });

  describe("3. Deterministic Date & Time Sorting", () => {
    const rawUpcoming = [
      {
        id: "later-date",
        appointment_date: "2026-10-20",
        appointment_time: "10:00 AM",
        created_at: "2026-10-01T00:00:00Z", // Created earliest
      },
      {
        id: "soonest-afternoon",
        appointment_date: "2026-10-18",
        appointment_time: "3:30 PM", // 12-hour afternoon
        created_at: "2026-10-15T00:00:00Z",
      },
      {
        id: "soonest-morning",
        appointment_date: "2026-10-18",
        appointment_time: "11:00", // 24-hour morning
        created_at: "2026-10-17T00:00:00Z", // Created latest
      },
      {
        id: "middle-date",
        appointment_date: "2026-10-19",
        appointment_time: "09:00",
        created_at: "2026-10-10T00:00:00Z",
      },
    ];

    test("Upcoming sorting: appointment_date ascending, then time ascending (soonest first)", () => {
      const sorted = sortAppointmentsForTab(rawUpcoming, "upcoming");
      const sortedIds = sorted.map((a) => a.id);

      // Oct 18 11:00 (morning) -> Oct 18 3:30 PM (afternoon) -> Oct 19 09:00 -> Oct 20 10:00 AM
      assert.deepEqual(sortedIds, [
        "soonest-morning",
        "soonest-afternoon",
        "middle-date",
        "later-date",
      ]);
    });

    test("Upcoming sorting NEVER sorts by created_at", () => {
      const sorted = sortAppointmentsForTab(rawUpcoming, "upcoming");
      // "soonest-morning" was created last (Oct 17), but must be first because appointment_date & time are earliest
      assert.equal(sorted[0].id, "soonest-morning");
      assert.equal(sorted[0].created_at, "2026-10-17T00:00:00Z");
    });

    const rawCompleted = [
      {
        id: "older-day",
        appointment_date: "2026-10-10",
        appointment_time: "14:00",
      },
      {
        id: "recent-day-morning",
        appointment_date: "2026-10-15",
        appointment_time: "10:00 AM",
      },
      {
        id: "recent-day-afternoon",
        appointment_date: "2026-10-15",
        appointment_time: "3:30 PM",
      },
    ];

    test("Completed and Cancelled sorting: date descending, then time descending (most recent first)", () => {
      const sortedCompleted = sortAppointmentsForTab(rawCompleted, "completed");
      const sortedCancelled = sortAppointmentsForTab(rawCompleted, "cancelled");

      // Oct 15 3:30 PM -> Oct 15 10:00 AM -> Oct 10 14:00
      assert.deepEqual(
        sortedCompleted.map((a) => a.id),
        ["recent-day-afternoon", "recent-day-morning", "older-day"]
      );
      assert.deepEqual(
        sortedCancelled.map((a) => a.id),
        ["recent-day-afternoon", "recent-day-morning", "older-day"]
      );
    });

    test("handles mixed 12-hour and 24-hour times on identical dates without raw text comparison error", () => {
      const mixedTimes = [
        { id: "noon", appointment_date: "2026-10-18", appointment_time: "12:00 PM" }, // 720
        { id: "eleven-am", appointment_date: "2026-10-18", appointment_time: "11:00 AM" }, // 660
        { id: "nine-twentyfour", appointment_date: "2026-10-18", appointment_time: "09:00" }, // 540
        { id: "three-thirty-pm", appointment_date: "2026-10-18", appointment_time: "3:30 PM" }, // 930
      ];

      // Alphabetical sorting would put "11:00 AM" before "09:00", and "3:30 PM" before "09:00".
      // Correct minute sorting: 09:00 (540) -> 11:00 AM (660) -> 12:00 PM (720) -> 3:30 PM (930)
      const sorted = sortAppointmentsForTab(mixedTimes, "upcoming");
      assert.deepEqual(
        sorted.map((a) => a.id),
        ["nine-twentyfour", "eleven-am", "noon", "three-thirty-pm"]
      );
    });
  });

  describe("4. Date Grouping & Header Formatting", () => {
    test("formatDateHeader outputs clean human-readable day and date format", () => {
      const header = formatDateHeader("2026-10-18");
      assert.equal(header, "Sunday, October 18, 2026");
    });

    test("groups consecutive sorted appointments under date headers in order", () => {
      const sortedAppts = [
        { id: "a1", appointment_date: "2026-10-18", appointment_time: "10:00 AM", status: "confirmed" },
        { id: "a2", appointment_date: "2026-10-18", appointment_time: "11:30 AM", status: "confirmed" },
        { id: "a3", appointment_date: "2026-10-19", appointment_time: "09:00", status: "confirmed" },
      ];

      const groups = groupAppointmentsByDate(sortedAppts);
      assert.equal(groups.length, 2);

      assert.equal(groups[0].date, "2026-10-18");
      assert.equal(groups[0].formattedDate, "Sunday, October 18, 2026");
      assert.equal(groups[0].appointments.length, 2);
      assert.deepEqual(groups[0].appointments.map((a) => a.id), ["a1", "a2"]);

      assert.equal(groups[1].date, "2026-10-19");
      assert.equal(groups[1].formattedDate, "Monday, October 19, 2026");
      assert.equal(groups[1].appointments.length, 1);
      assert.deepEqual(groups[1].appointments.map((a) => a.id), ["a3"]);
    });

    test("getTabAppointmentsGroupedByDate integrates filter, sort, and group pipeline", () => {
      const mixedData = [
        { id: "c1", appointment_date: "2026-10-18", appointment_time: "10:00 AM", status: "completed" },
        { id: "u2", appointment_date: "2026-10-19", appointment_time: "11:00 AM", status: "confirmed" },
        { id: "u1", appointment_date: "2026-10-18", appointment_time: "3:30 PM", status: "pending" },
        { id: "x1", appointment_date: "2026-10-18", appointment_time: "09:00", status: "cancelled" },
      ];

      const upcomingGroups = getTabAppointmentsGroupedByDate(mixedData, "upcoming");
      assert.equal(upcomingGroups.length, 2);
      assert.equal(upcomingGroups[0].date, "2026-10-18");
      assert.deepEqual(upcomingGroups[0].appointments.map((a) => a.id), ["u1"]);
      assert.equal(upcomingGroups[1].date, "2026-10-19");
      assert.deepEqual(upcomingGroups[1].appointments.map((a) => a.id), ["u2"]);
    });
  });
});
