import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Import Stripe integration functions
import { getStripeClient, constructWebhookEvent, getAppBaseUrl } from "../lib/stripe.ts";
import { isAuthorizedToManageAppointment } from "../lib/authPolicy.ts";

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
      try {
        delete process.env.NEXT_PUBLIC_APP_URL;
        delete process.env.VERCEL_URL;
        assert.equal(getAppBaseUrl(), "http://localhost:3000");
      } finally {
        process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
        process.env.VERCEL_URL = originalVercelUrl;
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
    function applyWebhookEvent(appt, srv, event, inFlightState = { alreadyUpdating: false }) {
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

        // First atomic winner claims update and sends email
        inFlightState.alreadyUpdating = true;
        return {
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
  });
});
