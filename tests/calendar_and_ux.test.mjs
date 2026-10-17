import { test, describe } from "node:test";
import assert from "node:assert/strict";

// We import application logic modules
import { imageForService, DEFAULT_CATEGORY_IMAGES } from "../lib/serviceImages.ts";
import { BUSINESS_HOURS, generateSlotsForDate } from "../lib/businessHours.ts";
import { isValidEmail, validateManilaBookingTime } from "../lib/validation.ts";
import { siteConfig } from "../lib/data.ts";

describe("Customer Experience & Calendar Logic", () => {
  describe("1. Service Images & Fallbacks", () => {
    test("uses explicit image_url if provided and valid", () => {
      const img = imageForService({
        name: "Lash Lift",
        category: "Lash Lift",
        image_url: "https://example.com/custom-lift.jpg",
      });
      assert.equal(img, "https://example.com/custom-lift.jpg");
    });

    test("falls back to category defaults when image_url is missing or empty", () => {
      assert.equal(
        imageForService({ name: "Classic Full Set", category: "Eyelash Extensions", image_url: null }),
        "/gallery/lash_extensions.jpg"
      );
      assert.equal(
        imageForService({ name: "Keratin Lash Lift", category: "Lash Lift", image_url: "" }),
        "/gallery/brow_lamination.jpg"
      );
      assert.equal(
        imageForService({ name: "Gel Extensions", category: "Nails", image_url: undefined }),
        "/gallery/nail_art.jpg"
      );
    });

    test("resolves image based on service name heuristics if category is missing or custom", () => {
      assert.equal(
        imageForService({ name: "Express Brow Tint & Lamination", category: null }),
        "/gallery/brow_lamination.jpg"
      );
      assert.equal(
        imageForService({ name: "Russian Mega Volume Set", category: null }),
        "/gallery/lash_extensions.jpg"
      );
      assert.equal(
        imageForService({ name: "Luxury French Manicure & Polish", category: null }),
        "/gallery/nail_art.jpg"
      );
      assert.equal(
        imageForService({ name: "General Beauty Consultation", category: null }),
        "/gallery/studio_interior.jpg"
      );
    });

    test("resolves correct image for cards and detail views", () => {
      const srv = {
        id: "srv_123",
        name: "Volume Lash Extensions",
        description: "Full volume fluffy lash set",
        duration_minutes: 90,
        price: 1500,
        category: "Eyelash Extensions",
      };

      assert.equal(imageForService(srv), "/gallery/lash_extensions.jpg");
      assert.equal(DEFAULT_CATEGORY_IMAGES["Eyelash Extensions"], "/gallery/lash_extensions.jpg");
      assert.equal(DEFAULT_CATEGORY_IMAGES["Lash Lift"], "/gallery/brow_lamination.jpg");
      assert.equal(DEFAULT_CATEGORY_IMAGES["Nails"], "/gallery/nail_art.jpg");
    });
  });

  describe("2. Calendar & Asia/Manila Date Consistency", () => {
    test("Business hours correctly configured for all 7 days", () => {
      // Sunday (0)
      assert.deepEqual(BUSINESS_HOURS[0], { open: "11:00", close: "16:00" });
      // Monday through Friday (1 - 5)
      for (let day = 1; day <= 5; day++) {
        assert.deepEqual(BUSINESS_HOURS[day], { open: "09:00", close: "19:00" });
      }
      // Saturday (6)
      assert.deepEqual(BUSINESS_HOURS[6], { open: "09:00", close: "18:00" });
    });

    test("generateSlotsForDate respects Sunday opening and closing hours", () => {
      // 2026-10-18 is a Sunday
      const sundayDate = new Date("2026-10-18T00:00:00");
      const slots = generateSlotsForDate(sundayDate, 60);

      assert.ok(slots.length > 0);
      assert.equal(slots[0], "11:00 AM");
      // 60-min service must finish by 16:00 (4:00 PM), so last start time is 3:00 PM
      assert.equal(slots[slots.length - 1], "3:00 PM");
    });

    test("generateSlotsForDate respects Weekday opening and closing hours", () => {
      // 2026-10-19 is a Monday
      const mondayDate = new Date("2026-10-19T00:00:00");
      const slots = generateSlotsForDate(mondayDate, 60);

      assert.ok(slots.length > 0);
      assert.equal(slots[0], "9:00 AM");
      // 60-min service must finish by 19:00 (7:00 PM), so last start time is 6:00 PM
      assert.equal(slots[slots.length - 1], "6:00 PM");
    });

    test("validateManilaBookingTime correctly validates Manila time constraints", () => {
      // In the past
      const pastValidation = validateManilaBookingTime("2020-01-01", "10:00 AM");
      assert.equal(pastValidation.valid, false);

      // Future date
      const futureValidation = validateManilaBookingTime("2026-11-20", "10:00 AM");
      assert.equal(futureValidation.valid, true);
      assert.equal(futureValidation.normalizedTime, "10:00");

      // Non-existent calendar date (e.g. Feb 31)
      const invalidDate = validateManilaBookingTime("2026-02-31", "10:00 AM");
      assert.equal(invalidDate.valid, false);

      // Malformed time string
      const malformedTime = validateManilaBookingTime("2026-11-20", "invalid-time");
      assert.equal(malformedTime.valid, false);
    });
  });

  describe("3. Salon Address & Location Verification", () => {
    test("Verified address is Butuan City and does not fabricate fake details", () => {
      assert.equal(siteConfig.address, "Butuan City, Purok - Magdamayan, Agusan del Norte, Philippines");
      assert.equal(siteConfig.phone, "+63 (938) 894-4690");
      assert.equal(siteConfig.email, "danielle.acierda@urios.edu.ph");
    });
  });

  describe("4. Email Validation Client & Server Consistency", () => {
    test("Rejects invalid and accepts valid RFC emails", () => {
      assert.equal(isValidEmail("maria.santos@gmail.com"), true);
      assert.equal(isValidEmail("guest@quinnluxurious.ph"), true);

      assert.equal(isValidEmail("not-an-email"), false);
      assert.equal(isValidEmail("test..user@gmail.com"), false);
      assert.equal(isValidEmail("spaces in@email.com"), false);
      assert.equal(isValidEmail("@domain.com"), false);
    });
  });
});
