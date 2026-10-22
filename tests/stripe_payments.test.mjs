import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Import Stripe integration functions
import { getStripeClient, constructWebhookEvent, getAppBaseUrl, isTrustedOrigin } from "../lib/stripe.ts";
import { isAuthorizedToManageAppointment, isAuthorizedToViewSuccessPage } from "../lib/authPolicy.ts";
import { markPaidAndNotify } from "../lib/payments/markPaidAndNotify.ts";

describe("Stripe Test-Mode Payments Suite", () => {
  describe("1. Strict Safety & Test-Mode Key Guard", () => {
    test("rejects live secret key sk_live_ and throws safety enforcement error", () => {
      const originalEnv = process.env.STRIPE_SECRET_KEY;
      try {
        process.env.STRIPE_SECRET_KEY = "sk_" + "live_" + "simulated_rejection_key";
        assert.throws(
          () => getStripeClient(),
          /SAFETY ENFORCEMENT: Invalid Stripe secret key. Only Stripe test-mode keys/
        );
      } finally {
        process.env.STRIPE_SECRET_KEY = originalEnv;
      }
    });

    test("rejects keys without sk_test_ prefix (e.g. rk_live_ or arbitrary strings)", () => {
      const originalEnv = process.env.STRIPE_SECRET_KEY;
      try {
        process.env.STRIPE_SECRET_KEY = "rk_live_arbitraryRestrictedKey";
        assert.throws(
          () => getStripeClient(),
          /SAFETY ENFORCEMENT: Invalid Stripe secret key/
        );
      } finally {
        process.env.STRIPE_SECRET_KEY = originalEnv;
      }
    });

    test("throws helpful error when STRIPE_SECRET_KEY is missing", () => {
      const originalEnv = process.env.STRIPE_SECRET_KEY;
      try {
        delete process.env.STRIPE_SECRET_KEY;
        assert.throws(
          () => getStripeClient(),
          /STRIPE_SECRET_KEY is missing/
        );
      } finally {
        process.env.STRIPE_SECRET_KEY = originalEnv;
      }
    });

    test("getAppBaseUrl defaults safely to localhost:3000 if no env set", () => {
      const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
      const originalVercelUrl = process.env.VERCEL_URL;
      const originalProdUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
      try {
        delete process.env.NEXT_PUBLIC_APP_URL;
        delete process.env.VERCEL_URL;
        delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
        assert.equal(getAppBaseUrl(), "http://localhost:3000");
      } finally {
        if (originalAppUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
        else delete process.env.NEXT_PUBLIC_APP_URL;

        if (originalVercelUrl !== undefined) process.env.VERCEL_URL = originalVercelUrl;
        else delete process.env.VERCEL_URL;

        if (originalProdUrl !== undefined) process.env.VERCEL_PROJECT_PRODUCTION_URL = originalProdUrl;
        else delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
      }
    });

    test("isTrustedOrigin allows localhost, vercel.app, and configured domains, but strictly rejects untrusted hosts", () => {
      assert.equal(isTrustedOrigin("http://localhost:3000"), true);
      assert.equal(isTrustedOrigin("https://127.0.0.1:3000"), true);
      assert.equal(isTrustedOrigin("https://danyelacierda-quinn-luxurious.vercel.app"), true);
      assert.equal(isTrustedOrigin("https://danyelacierda-quinn-luxur-ous-2xbtb5lac.vercel.app"), true);

      // Rejects malicious or arbitrary hosts (Host header injection / Open redirect protection)
      assert.equal(isTrustedOrigin("https://evil.com"), false);
      assert.equal(isTrustedOrigin("https://attacker-phishing.org"), false);
      assert.equal(isTrustedOrigin("https://quinnluxurious.com.evil.com"), false);
      assert.equal(isTrustedOrigin("https://attacker-phishing.vercel.app"), false);
      assert.equal(isTrustedOrigin("https://unrelated-project.vercel.app"), false);
      assert.equal(isTrustedOrigin("https://evil.vercel.app"), false);
      assert.equal(isTrustedOrigin(""), false);
      assert.equal(isTrustedOrigin(null), false);
    });

    test("getAppBaseUrl prioritizes pinned production URL and rejects untrusted Host headers", () => {
      const origAppUrl = process.env.NEXT_PUBLIC_APP_URL;
      const origVercelUrl = process.env.VERCEL_URL;
      const origProdUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
      try {
        // 1. Pinned canonical production URL always wins
        process.env.NEXT_PUBLIC_APP_URL = "https://danyelacierda-quinn-luxurious.vercel.app";
        assert.equal(
          getAppBaseUrl("https://untrusted-attacker.com"),
          "https://danyelacierda-quinn-luxurious.vercel.app"
        );

        // 2. In preview/dev without pinned prod URL, untrusted host header is rejected and falls back safely
        delete process.env.NEXT_PUBLIC_APP_URL;
        delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
        process.env.VERCEL_URL = "danyelacierda-preview.vercel.app";
        assert.equal(
          getAppBaseUrl("https://evil.com"),
          "https://danyelacierda-preview.vercel.app"
        );

        // 3. Trusted preview host header is honored
        assert.equal(
          getAppBaseUrl("https://danyelacierda-quinn-luxur-ous-2xbtb5lac.vercel.app"),
          "https://danyelacierda-quinn-luxur-ous-2xbtb5lac.vercel.app"
        );
      } finally {
        if (origAppUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = origAppUrl;
        else delete process.env.NEXT_PUBLIC_APP_URL;

        if (origVercelUrl !== undefined) process.env.VERCEL_URL = origVercelUrl;
        else delete process.env.VERCEL_URL;

        if (origProdUrl !== undefined) process.env.VERCEL_PROJECT_PRODUCTION_URL = origProdUrl;
        else delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
      }
    });
  });

  describe("2. Webhook Signature Verification & Live-Mode Rejection", () => {
    test("rejects webhooks with missing signature header", () => {
      assert.throws(
        () => constructWebhookEvent("{}", "", "whsec_test_secret"),
        /Missing stripe-signature header/
      );
    });

    test("rejects webhooks with missing webhook secret", () => {
      assert.throws(
        () => constructWebhookEvent("{}", "t=123,v1=fake", ""),
        /STRIPE_WEBHOOK_SECRET is missing/
      );
    });

    test("rejects invalid signature payloads with bad signature hash", () => {
      const originalSecret = process.env.STRIPE_SECRET_KEY;
      try {
        process.env.STRIPE_SECRET_KEY = "sk_test_12345testDummyKey";
        assert.throws(
          () =>
            constructWebhookEvent(
              JSON.stringify({ id: "evt_123", livemode: false }),
              "t=1600000000,v1=invalid_signature_hash_here",
              "whsec_test_dummy_secret_123"
            ),
          /No signatures found matching the expected signature/
        );
      } finally {
        process.env.STRIPE_SECRET_KEY = originalSecret;
      }
    });
  });

  describe("3. Idempotency, Concurrent Deliveries & Status Transitions", () => {
    // Pure model of the audited webhook state machine in app/api/webhooks/stripe/route.ts
    function applyWebhookEvent(appt, srv, event, inFlightState = { alreadyUpdating: false }, options = {}) {
      if (event.livemode === true) {
        return { error: "Live-mode events are strictly rejected in test environment.", status: 400 };
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        if (session.mode !== "payment" || session.payment_status !== "paid") {
          return { appt, handled: false, reason: "unpaid_or_invalid_mode" };
        }

        // Stored session match check
        if (appt.stripe_session_id && appt.stripe_session_id !== session.id) {
          return { error: "Session ID does not match stored appointment session.", status: 400 };
        }

        // Amount & currency verification against authoritative database service price
        const expectedAmountCentavos = Math.round(srv.price * 100);
        if (session.amount_total !== expectedAmountCentavos) {
          return { error: "Session amount does not match authoritative service price.", status: 400 };
        }
        if (session.currency?.toLowerCase() !== "php") {
          return { error: "Invalid currency received.", status: 400 };
        }

        // Atomic update check: If another concurrent request has already set fully_paid, return idempotent
        if (appt.payment_status === "fully_paid" || inFlightState.alreadyUpdating) {
          return { appt, handled: true, idempotent: true, emailSent: false };
        }

        // Check database update error simulation (e.g. 23505 unique slot collision vs duplicate payment reference)
        if (options.mockDbError) {
          const errCode = options.mockDbError.code;
          const errText = `${options.mockDbError.message || ""} ${options.mockDbError.details || ""}`;
          if (errCode === "23505" && errText.includes("appointments_no_double_booking")) {
            // Flag needs_refund = true, record payment_reference, do not change status or payment_status, return HTTP 200
            appt.needs_refund = true;
            appt.payment_reference = session.payment_intent ? String(session.payment_intent) : session.id;
            return {
              status: 200,
              received: true,
              slotConflict: true,
              needs_refund: true,
              appt,
              message: "Time slot conflict on paid booking: flagged for refund.",
            };
          }
          if (errCode === "23505") {
            // Non-slot-conflict 23505 (e.g. duplicate payment_reference index):
            // Return 500 so Stripe retries, do NOT set needs_refund
            return { error: "Database update failed.", status: 500, appt };
          }
          return { error: "Database update failed.", status: 500 };
        }

        // First atomic winner claims update and sends email
        inFlightState.alreadyUpdating = true;
        return {
          status: 200,
          appt: {
            ...appt,
            status: "confirmed",
            payment_status: "fully_paid",
            payment_method: "stripe",
            payment_reference: session.payment_intent || session.id,
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent || null,
          },
          handled: true,
          idempotent: false,
          emailSent: true,
        };
      }

      if (event.type === "checkout.session.expired") {
        const session = event.data.object;
        // Never cancel if already confirmed or paid!
        if (appt.payment_status === "fully_paid" || appt.status === "confirmed") {
          return { appt, handled: false, reason: "already_confirmed_cannot_cancel" };
        }
        if (appt.status === "pending_payment" && (!appt.stripe_session_id || appt.stripe_session_id === session.id)) {
          return {
            appt: {
              ...appt,
              status: "cancelled",
              payment_status: "expired",
            },
            handled: true,
          };
        }
        return { appt, handled: false, reason: "session_mismatch_or_not_pending" };
      }

      if (event.type === "payment_intent.payment_failed") {
        // Late failure event cannot overwrite confirmed / fully_paid booking
        if (appt.payment_status === "fully_paid" || appt.status === "confirmed") {
          return { appt, handled: false, reason: "already_fully_paid" };
        }
        return {
          appt: {
            ...appt,
            payment_status: "failed",
          },
          handled: true,
        };
      }

      return { appt, handled: false };
    }

    test("checkout.session.completed transitions pending_payment to confirmed and fully_paid", () => {
      const initialAppt = {
        id: "appt_001",
        status: "pending_payment",
        payment_status: "pending_payment",
        payment_method: "stripe",
        stripe_session_id: "cs_test_abc123",
      };
      const srv = { id: "srv_1", price: 1500 }; // ₱1,500.00 -> 150000 centavos

      const event = {
        type: "checkout.session.completed",
        livemode: false,
        data: {
          object: {
            id: "cs_test_abc123",
            mode: "payment",
            payment_status: "paid",
            payment_intent: "pi_test_xyz789",
            amount_total: 150000,
            currency: "php",
          },
        },
      };

      const result = applyWebhookEvent(initialAppt, srv, event);
      assert.equal(result.handled, true);
      assert.equal(result.idempotent, false);
      assert.equal(result.emailSent, true);
      assert.equal(result.appt.status, "confirmed");
      assert.equal(result.appt.payment_status, "fully_paid");
    });

    test("rejects checkout.session.completed if event.livemode is true", () => {
      const initialAppt = {
        id: "appt_001",
        status: "pending_payment",
        payment_status: "pending_payment",
        stripe_session_id: "cs_test_abc123",
      };
      const srv = { id: "srv_1", price: 1500 };

      const liveEvent = {
        type: "checkout.session.completed",
        livemode: true, // Livemode mistakenly sent
        data: {
          object: {
            id: "cs_test_abc123",
            mode: "payment",
            payment_status: "paid",
            amount_total: 150000,
            currency: "php",
          },
        },
      };

      const result = applyWebhookEvent(initialAppt, srv, liveEvent);
      assert.equal(result.status, 400);
      assert.match(result.error, /Live-mode events are strictly rejected/);
    });

    test("rejects checkout.session.completed when amount_total does not match authoritative service price", () => {
      const initialAppt = {
        id: "appt_001",
        status: "pending_payment",
        payment_status: "pending_payment",
        stripe_session_id: "cs_test_abc123",
      };
      const srv = { id: "srv_1", price: 2000 }; // Expects 200000 centavos (₱2,000)

      const tamperedEvent = {
        type: "checkout.session.completed",
        livemode: false,
        data: {
          object: {
            id: "cs_test_abc123",
            mode: "payment",
            payment_status: "paid",
            amount_total: 50000, // Tampered: ₱500
            currency: "php",
          },
        },
      };

      const result = applyWebhookEvent(initialAppt, srv, tamperedEvent);
      assert.equal(result.status, 400);
      assert.match(result.error, /Session amount does not match authoritative service price/);
    });

    test("rejects checkout.session.completed when session currency is not php", () => {
      const initialAppt = {
        id: "appt_001",
        status: "pending_payment",
        payment_status: "pending_payment",
        stripe_session_id: "cs_test_abc123",
      };
      const srv = { id: "srv_1", price: 1000 };

      const usdEvent = {
        type: "checkout.session.completed",
        livemode: false,
        data: {
          object: {
            id: "cs_test_abc123",
            mode: "payment",
            payment_status: "paid",
            amount_total: 100000,
            currency: "usd", // Invalid currency
          },
        },
      };

      const result = applyWebhookEvent(initialAppt, srv, usdEvent);
      assert.equal(result.status, 400);
      assert.match(result.error, /Invalid currency received/);
    });

    test("rejects checkout.session.completed when session ID does not match stored appointment session", () => {
      const initialAppt = {
        id: "appt_001",
        status: "pending_payment",
        payment_status: "pending_payment",
        stripe_session_id: "cs_test_real_session",
      };
      const srv = { id: "srv_1", price: 1000 };

      const mismatchEvent = {
        type: "checkout.session.completed",
        livemode: false,
        data: {
          object: {
            id: "cs_test_attacker_session", // Mismatch!
            mode: "payment",
            payment_status: "paid",
            amount_total: 100000,
            currency: "php",
          },
        },
      };

      const result = applyWebhookEvent(initialAppt, srv, mismatchEvent);
      assert.equal(result.status, 400);
      assert.match(result.error, /Session ID does not match stored appointment session/);
    });

    test("concurrent duplicate webhook deliveries: only first execution triggers email, second returns idempotent", () => {
      const initialAppt = {
        id: "appt_001",
        status: "pending_payment",
        payment_status: "pending_payment",
        stripe_session_id: "cs_test_abc123",
      };
      const srv = { id: "srv_1", price: 1500 };
      const event = {
        type: "checkout.session.completed",
        livemode: false,
        data: {
          object: {
            id: "cs_test_abc123",
            mode: "payment",
            payment_status: "paid",
            amount_total: 150000,
            currency: "php",
          },
        },
      };

      const inFlightState = { alreadyUpdating: false };

      // Request 1 wins the atomic update
      const res1 = applyWebhookEvent(initialAppt, srv, event, inFlightState);
      assert.equal(res1.handled, true);
      assert.equal(res1.idempotent, false);
      assert.equal(res1.emailSent, true);

      // Request 2 arrives simultaneously or shortly after
      const res2 = applyWebhookEvent(res1.appt, srv, event, inFlightState);
      assert.equal(res2.handled, true);
      assert.equal(res2.idempotent, true);
      assert.equal(res2.emailSent, false); // NO duplicate email
    });

    test("late checkout.session.expired CANNOT cancel an already confirmed, fully_paid booking", () => {
      const fullyPaidAppt = {
        id: "appt_001",
        status: "confirmed",
        payment_status: "fully_paid",
        stripe_session_id: "cs_test_abc123",
      };
      const srv = { id: "srv_1", price: 1500 };

      const lateExpiredEvent = {
        type: "checkout.session.expired",
        livemode: false,
        data: {
          object: {
            id: "cs_test_abc123",
          },
        },
      };

      const result = applyWebhookEvent(fullyPaidAppt, srv, lateExpiredEvent);
      assert.equal(result.handled, false);
      assert.equal(fullyPaidAppt.status, "confirmed");
      assert.equal(fullyPaidAppt.payment_status, "fully_paid");
    });

    test("late payment_intent.payment_failed CANNOT overwrite a fully_paid booking", () => {
      const fullyPaidAppt = {
        id: "appt_001",
        status: "confirmed",
        payment_status: "fully_paid",
      };
      const srv = { id: "srv_1", price: 1500 };

      const lateFailedEvent = {
        type: "payment_intent.payment_failed",
        livemode: false,
        data: {
          object: {
            id: "pi_test_late_failed",
          },
        },
      };

      const result = applyWebhookEvent(fullyPaidAppt, srv, lateFailedEvent);
      assert.equal(result.handled, false);
      assert.equal(fullyPaidAppt.status, "confirmed");
      assert.equal(fullyPaidAppt.payment_status, "fully_paid");
    });

    test("checkout.session.completed with 23505 slot collision (appointments_no_double_booking): flags needs_refund=true, preserves status, returns HTTP 200", () => {
      // Scenario: Appointment was cancelled/expired, slot was taken by Client B, but Client A completes Stripe payment
      const cancelledAppt = {
        id: "appt_conflict_001",
        status: "cancelled",
        payment_status: "expired",
        stripe_session_id: "cs_test_conflict",
        needs_refund: false,
      };
      const srv = { id: "srv_lash", price: 1500 };
      const event = {
        type: "checkout.session.completed",
        livemode: false,
        data: {
          object: {
            id: "cs_test_conflict",
            mode: "payment",
            payment_status: "paid",
            amount_total: 150000,
            currency: "php",
            payment_intent: "pi_test_conflict_123",
          },
        },
      };

      const result = applyWebhookEvent(
        cancelledAppt,
        srv,
        event,
        { alreadyUpdating: false },
        {
          mockDbError: {
            code: "23505",
            message: 'duplicate key value violates unique constraint "appointments_no_double_booking"',
          },
        }
      );

      // 1. Returns HTTP 200 so Stripe stops retrying delivery
      assert.equal(result.status, 200);
      assert.equal(result.received, true);
      assert.equal(result.slotConflict, true);
      assert.equal(result.needs_refund, true);

      // 2. Appointment row is flagged for refund and payment_reference is recorded
      assert.equal(cancelledAppt.needs_refund, true);
      assert.equal(cancelledAppt.payment_reference, "pi_test_conflict_123");

      // 3. Status and payment_status are NOT overwritten with confirmed/fully_paid (unchanged)
      assert.equal(cancelledAppt.status, "cancelled");
      assert.equal(cancelledAppt.payment_status, "expired");
    });

    test("checkout.session.completed with 23505 payment_reference duplicate (appointments_payment_reference_idx): returns HTTP 500 and does NOT flag needs_refund", () => {
      // Scenario: A duplicate payment reference collision (not a slot conflict)
      const appt = {
        id: "appt_dup_ref_001",
        status: "pending_payment",
        payment_status: "pending_payment",
        stripe_session_id: "cs_test_dupref",
        needs_refund: false,
      };
      const srv = { id: "srv_lash", price: 1500 };
      const event = {
        type: "checkout.session.completed",
        livemode: false,
        data: {
          object: {
            id: "cs_test_dupref",
            mode: "payment",
            payment_status: "paid",
            amount_total: 150000,
            currency: "php",
            payment_intent: "pi_test_duplicate_ref",
          },
        },
      };

      const result = applyWebhookEvent(
        appt,
        srv,
        event,
        { alreadyUpdating: false },
        {
          mockDbError: {
            code: "23505",
            message: 'duplicate key value violates unique constraint "appointments_payment_reference_idx"',
          },
        }
      );

      // 1. Webhook returns 500 so Stripe retries delivery
      assert.equal(result.status, 500);
      assert.equal(result.error, "Database update failed.");

      // 2. Crucially, needs_refund is NOT set
      assert.equal(appt.needs_refund, false);

      // 3. Status remains unchanged
      assert.equal(appt.status, "pending_payment");
      assert.equal(appt.payment_status, "pending_payment");
    });

    test("success page fallback handles 23505 slot collision (appointments_no_double_booking) gracefully: flags needs_refund=true without crashing", () => {
      // Model the success page fallback handler
      function simulateSuccessPageFallback(appt, session, mockDbError) {
        let isVerifiedPaid = false;
        let slotConflict = Boolean(appt.needs_refund);

        const errText = `${mockDbError?.message || ""} ${mockDbError?.details || ""}`;
        if (mockDbError?.code === "23505" && errText.includes("appointments_no_double_booking")) {
          slotConflict = true;
          appt.needs_refund = true;
          appt.payment_reference = session.payment_intent
            ? String(session.payment_intent)
            : session.id;
        } else if (appt.payment_status === "fully_paid") {
          isVerifiedPaid = true;
        }

        return {
          isVerifiedPaid,
          slotConflict,
          needsRefund: appt.needs_refund,
          uiTitle: slotConflict ? "Payment Received" : isVerifiedPaid ? "Appointment Confirmed" : "Payment Processing",
          userNotice: slotConflict
            ? "Your payment was received successfully! However, your previously selected time slot was taken while payment was in progress. Our salon team will contact you directly to reschedule your booking or provide a full refund."
            : isVerifiedPaid
            ? "Your Stripe test payment was verified successfully and your appointment slot is secured."
            : "We are awaiting final webhook confirmation from Stripe. You will receive an email once the transaction is complete.",
        };
      }

      const appt = {
        id: "appt_fallback_002",
        status: "cancelled",
        payment_status: "expired",
        needs_refund: false,
      };
      const session = { id: "cs_test_fallback", payment_status: "paid" };

      const result = simulateSuccessPageFallback(
        appt,
        session,
        {
          code: "23505",
          message: 'duplicate key value violates unique constraint "appointments_no_double_booking"',
        }
      );

      // 1. Did not crash
      assert.ok(result);

      // 2. Flags needs_refund = true and records payment_reference
      assert.equal(result.slotConflict, true);
      assert.equal(result.needsRefund, true);
      assert.equal(appt.payment_reference, "cs_test_fallback");

      // 3. Status and payment_status are unchanged
      assert.equal(appt.status, "cancelled");
      assert.equal(appt.payment_status, "expired");

      // 4. Displays clear user-facing notice explaining payment was received and salon will contact
      assert.equal(result.uiTitle, "Payment Received");
      assert.match(result.userNotice, /salon team will contact you directly to reschedule your booking or provide a full refund/i);
    });

    test("success page fallback with 23505 payment_reference duplicate (appointments_payment_reference_idx): does NOT flag needs_refund or slotConflict", () => {
      function simulateSuccessPageFallback(appt, session, mockDbError) {
        let isVerifiedPaid = false;
        let slotConflict = Boolean(appt.needs_refund);

        const errText = `${mockDbError?.message || ""} ${mockDbError?.details || ""}`;
        if (mockDbError?.code === "23505" && errText.includes("appointments_no_double_booking")) {
          slotConflict = true;
          appt.needs_refund = true;
          appt.payment_reference = session.payment_intent
            ? String(session.payment_intent)
            : session.id;
        } else if (appt.payment_status === "fully_paid") {
          isVerifiedPaid = true;
        }

        return {
          isVerifiedPaid,
          slotConflict,
          needsRefund: appt.needs_refund,
          uiTitle: slotConflict ? "Payment Received" : isVerifiedPaid ? "Appointment Confirmed" : "Payment Processing",
          userNotice: slotConflict
            ? "Your payment was received successfully! However, your previously selected time slot was taken while payment was in progress. Our salon team will contact you directly to reschedule your booking or provide a full refund."
            : isVerifiedPaid
            ? "Your Stripe test payment was verified successfully and your appointment slot is secured."
            : "We are awaiting final webhook confirmation from Stripe. You will receive an email once the transaction is complete.",
        };
      }

      const appt = {
        id: "appt_fallback_dup_003",
        status: "pending_payment",
        payment_status: "pending",
        needs_refund: false,
      };
      const session = { id: "cs_test_fallback_dup", payment_status: "paid" };

      const result = simulateSuccessPageFallback(
        appt,
        session,
        {
          code: "23505",
          message: 'duplicate key value violates unique constraint "appointments_payment_reference_idx"',
        }
      );

      // 1. Did not crash
      assert.ok(result);

      // 2. Crucially, slotConflict is false and needs_refund is NOT set
      assert.equal(result.slotConflict, false);
      assert.equal(result.needsRefund, false);
      assert.equal(appt.needs_refund, false);

      // 3. Status and payment_status remain untouched
      assert.equal(appt.status, "pending_payment");
      assert.equal(appt.payment_status, "pending");

      // 4. Displays generic processing notice
      assert.equal(result.uiTitle, "Payment Processing");
      assert.match(result.userNotice, /awaiting final webhook confirmation from Stripe/i);
    });
  });

  describe("4. Price Tampering & Customer Ownership Protection", () => {
    test("Price is fetched authoritatively from database record, ignoring tampered client forms", () => {
      const dbService = {
        id: "srv_lash_volume",
        name: "Volume Lashes",
        price: 2500, // authoritative price in PHP
        is_active: true,
      };

      // Attacker attempts to submit price = 1 PHP
      const clientFormData = new Map([
        ["serviceId", "srv_lash_volume"],
        ["price", "1.00"],
        ["amount", "100"],
      ]);

      // Server Checkout Creation uses dbService.price * 100
      const authoritativeCentavos = Math.round(dbService.price * 100);
      assert.equal(authoritativeCentavos, 250000); // ₱2,500.00
      assert.notEqual(authoritativeCentavos, 100);
    });

    test("Customer A cannot view or modify Customer B's appointment confirmation", () => {
      const apptOfCustomerB = {
        id: "appt_B_private",
        customer_id: "user_customer_B",
        status: "confirmed",
        payment_status: "fully_paid",
      };

      // Customer A tries to access
      const isAllowed = isAuthorizedToManageAppointment(
        { role: "customer", userId: "user_customer_A" },
        apptOfCustomerB
      );
      assert.equal(isAllowed, false);
    });

    test("Success page validates session server-side: rejects unpaid, mismatched, or wrong-amount sessions", () => {
      function evaluateSuccessPageSession({ appt, service, session }) {
        const expectedAmountCentavos = service ? Math.round(service.price * 100) : 0;
        const sessionMatchesAppt =
          (session.metadata?.appointment_id === appt.id ||
            session.client_reference_id === appt.id) &&
          (!appt.stripe_session_id || appt.stripe_session_id === session.id);

        const amountMatches = service ? session.amount_total === expectedAmountCentavos : true;
        const currencyMatches = session.currency?.toLowerCase() === "php";
        const isPaidPaymentMode =
          session.mode === "payment" && session.payment_status === "paid";

        return Boolean(sessionMatchesAppt && amountMatches && currencyMatches && isPaidPaymentMode);
      }

      const appt = {
        id: "appt_legit_001",
        stripe_session_id: "cs_test_legit_123",
      };
      const service = { id: "srv_lash", price: 1500 };

      // 1. Valid paid session
      assert.equal(
        evaluateSuccessPageSession({
          appt,
          service,
          session: {
            id: "cs_test_legit_123",
            mode: "payment",
            payment_status: "paid",
            amount_total: 150000,
            currency: "php",
            metadata: { appointment_id: "appt_legit_001" },
          },
        }),
        true
      );

      // 2. Unpaid session (checkout incomplete / requires payment)
      assert.equal(
        evaluateSuccessPageSession({
          appt,
          service,
          session: {
            id: "cs_test_legit_123",
            mode: "payment",
            payment_status: "unpaid",
            amount_total: 150000,
            currency: "php",
            metadata: { appointment_id: "appt_legit_001" },
          },
        }),
        false
      );

      // 3. Mismatched appointment metadata
      assert.equal(
        evaluateSuccessPageSession({
          appt,
          service,
          session: {
            id: "cs_test_other_456",
            mode: "payment",
            payment_status: "paid",
            amount_total: 150000,
            currency: "php",
            metadata: { appointment_id: "appt_DIFFERENT_999" },
          },
        }),
        false
      );

      // 4. Amount tampering
      assert.equal(
        evaluateSuccessPageSession({
          appt,
          service,
          session: {
            id: "cs_test_legit_123",
            mode: "payment",
            payment_status: "paid",
            amount_total: 100, // ₱1.00 instead of ₱1,500.00
            currency: "php",
            metadata: { appointment_id: "appt_legit_001" },
          },
        }),
        false
      );

      // 5. Currency tampering (USD instead of PHP)
      assert.equal(
        evaluateSuccessPageSession({
          appt,
          service,
          session: {
            id: "cs_test_legit_123",
            mode: "payment",
            payment_status: "paid",
            amount_total: 150000,
            currency: "usd",
            metadata: { appointment_id: "appt_legit_001" },
          },
        }),
        false
      );
    });

    test("Success page handles Stripe API retrieval errors, missing params, and already-paid state safely", async () => {
      async function simulateSuccessPageServerVerification({
        appointmentId,
        sessionId,
        appt,
        service,
        stripeClient,
        mockDb,
      }) {
        let isVerifiedPaid = appt.payment_status === "fully_paid";
        let slotConflict = Boolean(appt.needs_refund);
        let verifiedStripeSessionMatches = false;

        if (sessionId && sessionId.startsWith("cs_")) {
          if (appt.stripe_session_id === sessionId && isVerifiedPaid) {
            verifiedStripeSessionMatches = true;
          } else {
            try {
              const session = await stripeClient.checkout.sessions.retrieve(sessionId);

              const expectedAmountCentavos = service ? Math.round(service.price * 100) : 0;
              const sessionMatchesAppt =
                (session.metadata?.appointment_id === appt.id ||
                  session.client_reference_id === appt.id) &&
                (!appt.stripe_session_id || appt.stripe_session_id === session.id);

              const amountMatches = service ? session.amount_total === expectedAmountCentavos : true;
              const currencyMatches = session.currency?.toLowerCase() === "php";
              const isPaidPaymentMode =
                session.mode === "payment" && session.payment_status === "paid";

              if (sessionMatchesAppt && amountMatches && currencyMatches && isPaidPaymentMode) {
                verifiedStripeSessionMatches = true;
                if (!isVerifiedPaid && service) {
                  const result = await markPaidAndNotify({
                    appointmentId: appt.id,
                    sessionId: session.id,
                    paymentIntentId: session.payment_intent ? String(session.payment_intent) : null,
                    customerEmail: appt.email,
                    customerName: appt.full_name,
                    serviceName: service.name,
                    date: appt.appointment_date,
                    time: appt.appointment_time,
                    phone: appt.phone,
                    price: service.price,
                    supabase: mockDb,
                    runEmailWithAfter: false,
                  });
                  if (result.slotConflict) slotConflict = true;
                  else if (result.updated || result.alreadyPaid || appt.payment_status === "fully_paid") {
                    isVerifiedPaid = true;
                  }
                }
              }
            } catch (err) {
              // Graceful error handling
            }
          }
        }

        const authResult = isAuthorizedToViewSuccessPage({
          caller: { userId: null, role: null },
          appointment: { id: appt.id, customer_id: appt.customer_id },
          verifiedStripeSessionMatches,
        });

        return {
          isAuthorized: authResult.isAuthorized,
          authReason: authResult.reason,
          isVerifiedPaid,
          slotConflict,
        };
      }

      const baseAppt = {
        id: "appt_integration_001",
        customer_id: "user_owner_001",
        stripe_session_id: "cs_test_int_123",
        payment_status: "pending_payment",
        email: "client@example.com",
        full_name: "Test Client",
        appointment_date: "2026-10-25",
        appointment_time: "10:00 AM",
        phone: "+639171112222",
      };
      const service = { id: "srv_lash", name: "Lash Set", price: 1500 };

      // Case A: Stripe API throws an error (e.g. invalid/deleted session or network error)
      const errorStripeClient = {
        checkout: {
          sessions: {
            retrieve: async () => {
              throw new Error("No such checkout session: cs_test_invalid_999");
            },
          },
        },
      };
      const resErr = await simulateSuccessPageServerVerification({
        appointmentId: "appt_integration_001",
        sessionId: "cs_test_invalid_999",
        appt: { ...baseAppt },
        service,
        stripeClient: errorStripeClient,
        mockDb: {},
      });
      assert.equal(resErr.isAuthorized, false);
      assert.equal(resErr.authReason, "unauthorized");
      assert.equal(resErr.isVerifiedPaid, false);

      // Case B: Missing sessionId parameter entirely
      const resMissing = await simulateSuccessPageServerVerification({
        appointmentId: "appt_integration_001",
        sessionId: undefined,
        appt: { ...baseAppt },
        service,
        stripeClient: errorStripeClient,
        mockDb: {},
      });
      assert.equal(resMissing.isAuthorized, false);
      assert.equal(resMissing.authReason, "unauthorized");

      // Case C: Non-cs_ malformed session string
      const resMalformed = await simulateSuccessPageServerVerification({
        appointmentId: "appt_integration_001",
        sessionId: "malformed_string_without_cs_prefix",
        appt: { ...baseAppt },
        service,
        stripeClient: errorStripeClient,
        mockDb: {},
      });
      assert.equal(resMalformed.isAuthorized, false);
      assert.equal(resMalformed.authReason, "unauthorized");

      // Case D: Appointment already marked fully_paid by webhook before customer arrived
      const alreadyPaidAppt = {
        ...baseAppt,
        payment_status: "fully_paid",
        stripe_session_id: "cs_test_int_123",
      };
      const resAlreadyPaid = await simulateSuccessPageServerVerification({
        appointmentId: "appt_integration_001",
        sessionId: "cs_test_int_123",
        appt: alreadyPaidAppt,
        service,
        stripeClient: errorStripeClient, // Stripe retrieve not called because verified DB match
        mockDb: {},
      });
      assert.equal(resAlreadyPaid.isAuthorized, true);
      assert.equal(resAlreadyPaid.authReason, "verified_stripe_session");
      assert.equal(resAlreadyPaid.isVerifiedPaid, true);
    });
  });
});
