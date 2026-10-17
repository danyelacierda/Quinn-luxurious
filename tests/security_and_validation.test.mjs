import test from "node:test";
import assert from "node:assert/strict";

// Import real application validation & authorization policy functions directly
import { isValidEmail, validateManilaBookingTime, EMAIL_REGEX } from "../lib/validation.ts";
import {
  isAuthorizedToManageAppointment,
  resolveUserRole,
  isConfiguredAdminEmail,
} from "../lib/authPolicy.ts";

test("Email Validation Suite (Real Application Function: isValidEmail)", async (t) => {
  await t.test("accepts standard valid emails", () => {
    assert.equal(isValidEmail("danielle.acierda@urios.edu.ph"), true);
    assert.equal(isValidEmail("customer@gmail.com"), true);
    assert.equal(isValidEmail("client+salon@domain.co.uk"), true);
    assert.equal(isValidEmail("quinn_luxury@business.com"), true);
  });

  await t.test("rejects invalid email formats", () => {
    assert.equal(isValidEmail("plainaddress"), false);
    assert.equal(isValidEmail("@missingusername.com"), false);
    assert.equal(isValidEmail("username@.com"), false);
    assert.equal(isValidEmail("username@domain"), false); // missing tld
    assert.equal(isValidEmail("user name@domain.com"), false); // space
    assert.equal(isValidEmail("user@domain..com"), false); // consecutive dots
    assert.equal(isValidEmail(".user@domain.com"), false); // leading dot
    assert.equal(isValidEmail(""), false);
    assert.equal(isValidEmail(null), false);
    assert.equal(isValidEmail(undefined), false);
  });

  await t.test("rejects emails exceeding 255 characters", () => {
    const longEmail = "a".repeat(250) + "@domain.com";
    assert.equal(isValidEmail(longEmail), false);
  });
});

test("Asia/Manila Date and Time Validation Suite (Real Application Function: validateManilaBookingTime)", async (t) => {
  // Mock current instant: 2026-10-16 11:30:00 AM Manila Time (UTC: 2026-10-16T03:30:00Z)
  const referenceNow = new Date("2026-10-16T03:30:00Z");

  await t.test("rejects dates in the past", () => {
    const res = validateManilaBookingTime("2026-10-15", "14:00", referenceNow);
    assert.equal(res.valid, false);
    assert.match(res.error, /past/i);
  });

  await t.test("rejects same-day times that have already passed (24h format)", () => {
    const res = validateManilaBookingTime("2026-10-16", "09:00", referenceNow);
    assert.equal(res.valid, false);
    assert.match(res.error, /already passed/i);
  });

  await t.test("rejects same-day times that have already passed (12h format)", () => {
    const res = validateManilaBookingTime("2026-10-16", "9:00 AM", referenceNow);
    assert.equal(res.valid, false);
    assert.match(res.error, /already passed/i);
  });

  await t.test("rejects booking at the exact current minute", () => {
    const res = validateManilaBookingTime("2026-10-16", "11:30", referenceNow);
    assert.equal(res.valid, false);
    assert.match(res.error, /current minute/i);
  });

  await t.test("accepts same-day future time (24h format)", () => {
    const res = validateManilaBookingTime("2026-10-16", "14:00", referenceNow);
    assert.equal(res.valid, true);
    assert.equal(res.normalizedTime, "14:00");
  });

  await t.test("accepts same-day future time (12h format) and normalizes", () => {
    const res = validateManilaBookingTime("2026-10-16", "2:00 PM", referenceNow);
    assert.equal(res.valid, true);
    assert.equal(res.normalizedTime, "14:00");
  });

  await t.test("accepts future calendar dates", () => {
    const res = validateManilaBookingTime("2026-10-17", "09:00", referenceNow);
    assert.equal(res.valid, true);
    assert.equal(res.normalizedDate, "2026-10-17");
  });

  await t.test("rejects non-existent calendar dates", () => {
    const res = validateManilaBookingTime("2026-02-31", "14:00", referenceNow);
    assert.equal(res.valid, false);
    assert.match(res.error, /does not exist/i);
  });

  await t.test("rejects malformed time formats", () => {
    assert.equal(validateManilaBookingTime("2026-10-17", "25:00", referenceNow).valid, false);
    assert.equal(validateManilaBookingTime("2026-10-17", "14:00 PM", referenceNow).valid, false);
    assert.equal(validateManilaBookingTime("2026-10-17", "not-a-time", referenceNow).valid, false);
  });
});

test("IDOR Ownership & Authorization Suite (Real Application Function: isAuthorizedToManageAppointment)", async (t) => {
  await t.test("allows customer to modify their own appointment", () => {
    const allowed = isAuthorizedToManageAppointment(
      { userId: "user_customer_123", role: "customer" },
      "user_customer_123"
    );
    assert.equal(allowed, true);
  });

  await t.test("BLOCKS customer attempting to modify another customer's appointment (IDOR Protection)", () => {
    const allowed = isAuthorizedToManageAppointment(
      { userId: "user_attacker_999", role: "customer" },
      "user_victim_123"
    );
    assert.equal(allowed, false);
  });

  await t.test("allows staff member to manage any appointment", () => {
    const allowed = isAuthorizedToManageAppointment(
      { userId: "user_staff_456", role: "staff" },
      "user_victim_123"
    );
    assert.equal(allowed, true);
  });

  await t.test("allows admin to manage any appointment", () => {
    const allowed = isAuthorizedToManageAppointment(
      { userId: "user_admin_789", role: "admin" },
      "user_victim_123"
    );
    assert.equal(allowed, true);
  });

  await t.test("blocks unauthenticated callers", () => {
    const allowed = isAuthorizedToManageAppointment(
      { userId: null, role: null },
      "user_victim_123"
    );
    assert.equal(allowed, false);
  });

  await t.test("blocks customers from modifying unassigned guest appointments", () => {
    const allowed = isAuthorizedToManageAppointment(
      { userId: "user_customer_123", role: "customer" },
      null
    );
    assert.equal(allowed, false);
  });
});

test("Role Resolution & Untrusted Metadata Protection Suite (Real Application Function: resolveUserRole)", async (t) => {
  const adminEnv = "danielle.acierda@urios.edu.ph, admin@quinnluxurious.com";

  await t.test("resolves admin via verified email in ADMIN_EMAILS", () => {
    const role = resolveUserRole({
      primaryEmail: { emailAddress: "danielle.acierda@urios.edu.ph", isVerified: true },
      adminEmailsEnv: adminEnv,
    });
    assert.equal(role, "admin");
  });

  await t.test("BLOCKS unverified email even if email matches ADMIN_EMAILS", () => {
    const role = resolveUserRole({
      primaryEmail: { emailAddress: "danielle.acierda@urios.edu.ph", isVerified: false },
      adminEmailsEnv: adminEnv,
    });
    assert.equal(role, "customer"); // Must not promote unverified email
  });

  await t.test("resolves role from server-controlled publicMetadata", () => {
    const role = resolveUserRole({
      metadataRole: "staff",
      primaryEmail: { emailAddress: "staff@example.com", isVerified: true },
      adminEmailsEnv: adminEnv,
    });
    assert.equal(role, "staff");
  });

  await t.test("ignores unknown or arbitrary role strings from metadata", () => {
    const role = resolveUserRole({
      metadataRole: "super_root_hacker",
      primaryEmail: { emailAddress: "hacker@example.com", isVerified: true },
      adminEmailsEnv: adminEnv,
    });
    assert.equal(role, "customer");
  });
});
