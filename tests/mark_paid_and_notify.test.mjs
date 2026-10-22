import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { markPaidAndNotify } from "../lib/payments/markPaidAndNotify.ts";

function createMockSupabase(initialStatus = "pending_payment") {
  let payment_status = initialStatus;
  let status = "pending";
  let needs_refund = false;
  let updateCalls = 0;

  return {
    get state() {
      return { status, payment_status, needs_refund, updateCalls };
    },
    from(tableName) {
      assert.equal(tableName, "appointments");
      return {
        update(updateData) {
          return {
            eq(col, val) {
              return {
                neq(neqCol, neqVal) {
                  return {
                    select(selCol) {
                      updateCalls++;
                      if (payment_status !== neqVal) {
                        status = updateData.status || status;
                        payment_status = updateData.payment_status || payment_status;
                        return Promise.resolve({ data: [{ id: val }], error: null });
                      }
                      return Promise.resolve({ data: [], error: null });
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("Shared Payment & Notification Helper (markPaidAndNotify)", () => {
  test("update changes 1 row: confirmation email payload is dispatched once", async () => {
    const mockDb = createMockSupabase("pending_payment");
    const emailCalls = [];

    const mockSendEmail = async (payload) => {
      emailCalls.push(payload);
      return { success: true };
    };

    const result = await markPaidAndNotify({
      appointmentId: "appt_test_001",
      sessionId: "cs_test_session_123",
      paymentIntentId: "pi_test_intent_456",
      customerEmail: "customer@example.com",
      customerName: "Jane Doe",
      serviceName: "Lash Extensions",
      date: "2026-10-25",
      time: "2:00 PM",
      phone: "+639171234567",
      price: 1500,
      supabase: mockDb,
      sendEmailFn: mockSendEmail,
    });

    assert.equal(result.updated, true);
    assert.equal(result.alreadyPaid, false);
    assert.equal(mockDb.state.payment_status, "fully_paid");
    assert.equal(mockDb.state.status, "confirmed");

    // Verified: exactly one email dispatch occurred with the full unified payload
    assert.equal(emailCalls.length, 1);
    const sent = emailCalls[0];
    assert.equal(sent.customerEmail, "customer@example.com");
    assert.equal(sent.customerName, "Jane Doe");
    assert.equal(sent.serviceName, "Lash Extensions");
    assert.equal(sent.date, "2026-10-25");
    assert.equal(sent.time, "2:00 PM");
    assert.equal(sent.phone, "+639171234567");
    assert.equal(sent.price, 1500);
    assert.equal(sent.paymentMethod, "stripe");
    assert.equal(sent.paymentReference, "pi_test_intent_456");
  });

  test("update changes 0 rows (already paid): no email is sent", async () => {
    // Already fully paid before helper is called
    const mockDb = createMockSupabase("fully_paid");
    const emailCalls = [];

    const mockSendEmail = async (payload) => {
      emailCalls.push(payload);
    };

    const result = await markPaidAndNotify({
      appointmentId: "appt_test_002",
      sessionId: "cs_test_session_duplicate",
      paymentIntentId: "pi_test_intent_dup",
      customerEmail: "customer@example.com",
      customerName: "Jane Doe",
      serviceName: "Lash Extensions",
      date: "2026-10-25",
      time: "2:00 PM",
      supabase: mockDb,
      sendEmailFn: mockSendEmail,
    });

    assert.equal(result.updated, false);
    assert.equal(result.alreadyPaid, true);
    // Verified: zero emails sent when row was already paid
    assert.equal(emailCalls.length, 0);
  });

  test("email function throws: helper does not throw and booking stays paid", async () => {
    const mockDb = createMockSupabase("pending_payment");

    const throwingEmailFn = async () => {
      throw new Error("Simulated Gmail SMTP connection failure");
    };

    // Must NOT throw
    let errorCaught = null;
    let result = null;
    try {
      result = await markPaidAndNotify({
        appointmentId: "appt_test_003",
        sessionId: "cs_test_session_error",
        paymentIntentId: "pi_test_intent_err",
        customerEmail: "customer@example.com",
        customerName: "Jane Doe",
        serviceName: "Lash Extensions",
        date: "2026-10-25",
        time: "2:00 PM",
        supabase: mockDb,
        sendEmailFn: throwingEmailFn,
      });
    } catch (err) {
      errorCaught = err;
    }

    assert.equal(errorCaught, null, "markPaidAndNotify must never throw if email fails");
    assert.equal(result.updated, true);
    assert.equal(result.alreadyPaid, false);
    // Booking must remain safely marked fully_paid in database
    assert.equal(mockDb.state.payment_status, "fully_paid");
    assert.equal(mockDb.state.status, "confirmed");
  });

  test("calling helper twice for the same appointment sends only once", async () => {
    const mockDb = createMockSupabase("pending_payment");
    const emailCalls = [];

    const mockSendEmail = async (payload) => {
      emailCalls.push(payload);
    };

    // First call (e.g. from success page)
    const result1 = await markPaidAndNotify({
      appointmentId: "appt_test_004",
      sessionId: "cs_test_session_twice",
      customerEmail: "customer@example.com",
      customerName: "Jane Doe",
      serviceName: "Nail Art",
      date: "2026-10-26",
      time: "3:00 PM",
      supabase: mockDb,
      sendEmailFn: mockSendEmail,
    });

    assert.equal(result1.updated, true);
    assert.equal(result1.alreadyPaid, false);
    assert.equal(emailCalls.length, 1);

    // Second concurrent/subsequent call (e.g. from webhook)
    const result2 = await markPaidAndNotify({
      appointmentId: "appt_test_004",
      sessionId: "cs_test_session_twice",
      customerEmail: "customer@example.com",
      customerName: "Jane Doe",
      serviceName: "Nail Art",
      date: "2026-10-26",
      time: "3:00 PM",
      supabase: mockDb,
      sendEmailFn: mockSendEmail,
    });

    assert.equal(result2.updated, false);
    assert.equal(result2.alreadyPaid, true);
    // Verified: exactly one email sent across both calls
    assert.equal(emailCalls.length, 1);
  });
});
