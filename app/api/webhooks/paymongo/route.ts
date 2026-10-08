import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("Paymongo-Signature");
    if (!signatureHeader) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

    const parts = signatureHeader.split(",");
    let timestamp = "", testSignature = "", liveSignature = "";
    for (const part of parts) {
      const [key, value] = part.split("=");
      if (key === "t") timestamp = value;
      else if (key === "te") testSignature = value;
      else if (key === "li") liveSignature = value;
    }

    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
    if (!webhookSecret) return NextResponse.json({ error: "Server misconfig" }, { status: 500 });

    const signaturePayload = `${timestamp}.${rawBody}`;
    const expectedSignatureBuffer = Buffer.from(crypto.createHmac("sha256", webhookSecret).update(signaturePayload).digest("hex"));
    
    let isValid = false;
    if (testSignature) {
      const testSigBuf = Buffer.from(testSignature);
      if (testSigBuf.length === expectedSignatureBuffer.length && crypto.timingSafeEqual(expectedSignatureBuffer, testSigBuf)) isValid = true;
    }
    if (liveSignature && !isValid) {
      const liveSigBuf = Buffer.from(liveSignature);
      if (liveSigBuf.length === expectedSignatureBuffer.length && crypto.timingSafeEqual(expectedSignatureBuffer, liveSigBuf)) isValid = true;
    }
    if (!isValid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

    const event = JSON.parse(rawBody);
    console.log("PAYMONGO RAW BODY:", rawBody); // Temporary

    if (event.data.attributes.type === "checkout_session.payment.paid") {
      const checkoutId = event.data.attributes.data.id;
      const paymentData = event.data.attributes.data.attributes.payments?.[0]?.attributes;
      if (!paymentData) return NextResponse.json({ error: "No payment data found" }, { status: 400 });

      const amountPaidCentavos = paymentData.amount; // Int in centavos
      const paymentMethod = paymentData.source?.type || "unknown";

      const { data: appointment, error: fetchErr } = await supabaseAdmin
        .from("appointments")
        .select("*")
        .or(`paymongo_deposit_checkout_id.eq.${checkoutId},paymongo_balance_checkout_id.eq.${checkoutId}`)
        .maybeSingle();

      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
      if (!appointment) return NextResponse.json({ received: true, note: "Ignored: Unknown checkout ID" });

      const isDeposit = appointment.paymongo_deposit_checkout_id === checkoutId;

      // Idempotency
      if (isDeposit && appointment.payment_status === "deposit_paid") return NextResponse.json({ received: true });
      if (!isDeposit && appointment.payment_status === "fully_paid") return NextResponse.json({ received: true });

      // Amount Verification
      const expectedAmountCentavos = Math.round((isDeposit ? appointment.expected_deposit : appointment.expected_balance) * 100);
      let needsRefund = false;
      let adminNote = appointment.admin_notes || "";

      if (amountPaidCentavos !== expectedAmountCentavos) {
         needsRefund = true;
         adminNote += ` | AMOUNT MISMATCH: Paid ${amountPaidCentavos/100}, Expected ${expectedAmountCentavos/100}.`;
      }

      // Late Payment Handler
      if (appointment.status === "cancelled") {
        if (!isDeposit) {
          await supabaseAdmin.from("appointments").update({ needs_refund: true, admin_notes: adminNote + ` | LATE BALANCE: Cancelled slot received ${amountPaidCentavos/100}.` }).eq("id", appointment.id);
          return NextResponse.json({ received: true, note: "Late balance requires refund" });
        }

        const { error: reclaimErr } = await supabaseAdmin.from("appointments")
          .update({ 
            status: "confirmed", payment_status: "deposit_paid", 
            deposit_amount: amountPaidCentavos / 100, payment_method: paymentMethod, 
            needs_refund: needsRefund, admin_notes: adminNote + (needsRefund ? "" : " | LATE PAYMENT: Reclaimed successfully.")
          }).eq("id", appointment.id);
        
        if (reclaimErr) {
          if (reclaimErr.code === "23505") { // Unique Constraint
             await supabaseAdmin.from("appointments").update({ needs_refund: true, admin_notes: adminNote + ` | LATE PAYMENT: Slot stolen. Refund ${amountPaidCentavos/100}.` }).eq("id", appointment.id);
             return NextResponse.json({ received: true, note: "Late payment requires refund" });
          }
          return NextResponse.json({ error: reclaimErr.message }, { status: 500 });
        }
        return NextResponse.json({ received: true, note: "Late payment reclaimed slot" });
      }

      // Normal Success Update
      const updates = isDeposit ? {
        status: "confirmed",
        payment_status: "deposit_paid",
        deposit_amount: amountPaidCentavos / 100,
        payment_method: paymentMethod,
        needs_refund: needsRefund,
        admin_notes: needsRefund ? adminNote : appointment.admin_notes
      } : {
        payment_status: "fully_paid",
        balance_paid: amountPaidCentavos / 100,
        needs_refund: needsRefund,
        admin_notes: needsRefund ? adminNote : appointment.admin_notes
      };

      const { error: updateErr } = await supabaseAdmin.from("appointments").update(updates).eq("id", appointment.id);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
