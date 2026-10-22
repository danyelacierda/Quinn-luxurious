export interface MarkPaidOptions {
  appointmentId: string;
  sessionId: string;
  paymentIntentId?: string | null;
  customerEmail?: string;
  customerName?: string;
  serviceName?: string;
  date?: string;
  time?: string;
  phone?: string;
  price?: number;
  supabase?: any;
  runEmailWithAfter?: boolean;
  sendEmailFn?: (payload: any) => Promise<any>;
}

export interface MarkPaidResult {
  updated: boolean;
  alreadyPaid: boolean;
  slotConflict?: boolean;
  needsRefund?: boolean;
  error?: any;
}

/**
 * Atomic guarded update and notification helper for Stripe bookings.
 *
 * Guarantees:
 * 1. Atomically updates the appointment to 'fully_paid' only if payment_status is not already 'fully_paid'.
 * 2. Exactly one execution (either webhook or success page) will update the row and send emails.
 * 3. Sends both customer confirmation and admin alert using a single shared payload.
 * 4. Never throws if email fails: logs error with appointment ID and keeps booking marked paid.
 */
export async function markPaidAndNotify(
  options: MarkPaidOptions
): Promise<MarkPaidResult> {
  const {
    appointmentId,
    sessionId,
    paymentIntentId,
    supabase: injectedSupabase,
    runEmailWithAfter = false,
  } = options;

  let supabase = injectedSupabase;
  if (!supabase) {
    const adminMod = await import("@/lib/supabase/admin");
    supabase = adminMod.createAdminClient();
  }

  const paymentRef = paymentIntentId || sessionId;

  // 1. Guarded atomic update: update ONLY if payment_status is not already 'fully_paid'
  const { data: updatedRows, error: updateErr } = await supabase
    .from("appointments")
    .update({
      status: "confirmed",
      payment_status: "fully_paid",
      payment_method: "stripe",
      payment_reference: paymentRef,
      stripe_session_id: sessionId,
      stripe_payment_intent_id: paymentIntentId || null,
    })
    .eq("id", appointmentId)
    .neq("payment_status", "fully_paid")
    .select("id");

  // Handle errors / conflicts
  if (updateErr) {
    const errObj = updateErr as { code?: string; message?: string; details?: string };
    const errText = `${errObj?.message || ""} ${errObj?.details || ""}`;
    const isSlotConflict =
      errObj?.code === "23505" &&
      errText.includes("appointments_no_double_booking");

    if (isSlotConflict) {
      console.error(
        `[markPaidAndNotify] slot conflict (23505: appointments_no_double_booking), flagging for refund, appointment_id: ${appointmentId}`
      );
      const { error: refundErr } = await supabase
        .from("appointments")
        .update({
          needs_refund: true,
          payment_reference: paymentRef,
        })
        .eq("id", appointmentId);

      if (refundErr) {
        console.error(
          `[markPaidAndNotify] failed to flag needs_refund for appointment ${appointmentId}:`,
          refundErr.message
        );
      }

      return {
        updated: false,
        alreadyPaid: false,
        slotConflict: true,
        needsRefund: true,
      };
    }

    console.error(
      `[markPaidAndNotify] database update failed for appointment ${appointmentId}:`,
      updateErr.message || updateErr
    );
    return {
      updated: false,
      alreadyPaid: false,
      error: updateErr,
    };
  }

  // If 0 rows updated, it was already marked fully_paid concurrently
  if (!updatedRows || updatedRows.length === 0) {
    return {
      updated: false,
      alreadyPaid: true,
    };
  }

  // 2. Fetch missing fields for the email payload if not provided
  let email = options.customerEmail;
  let name = options.customerName;
  let serviceName = options.serviceName;
  let date = options.date;
  let time = options.time;
  let phone = options.phone;
  let price = options.price;

  if (!email || !name || !serviceName || !date || !time) {
    const { data: appt } = await supabase
      .from("appointments")
      .select("full_name, email, phone, appointment_date, appointment_time, services(name, price)")
      .eq("id", appointmentId)
      .maybeSingle();

    if (appt) {
      email = email || appt.email;
      name = name || appt.full_name;
      phone = phone || appt.phone;
      date = date || appt.appointment_date;
      time = time || appt.appointment_time;
      serviceName = serviceName || (appt.services as any)?.name || "Signature Service";
      if (price === undefined) {
        price = (appt.services as any)?.price;
      }
    }
  }

  let sendEmail = options.sendEmailFn;
  if (!sendEmail) {
    const emailMod = await import("@/lib/email");
    sendEmail = emailMod.sendBookingConfirmationEmail;
  }

  const dispatchEmail = async () => {
    try {
      await sendEmail({
        customerEmail: email || "",
        customerName: name || "Valued Client",
        serviceName: serviceName || "Signature Service",
        date: date || "",
        time: time || "",
        phone: phone || undefined,
        price: price !== undefined ? price : undefined,
        paymentMethod: "stripe",
        paymentReference: paymentRef,
      });
    } catch (emailErr: any) {
      console.error(
        `[markPaidAndNotify] Failed to send Stripe confirmation email for appointment ${appointmentId}:`,
        emailErr?.message || emailErr
      );
    }
  };

  // 3. Dispatch email: use after() if requested to avoid blocking HTML render, or await directly
  if (runEmailWithAfter) {
    try {
      const { after } = await import("next/server");
      after(dispatchEmail);
    } catch {
      // Fallback if after() is invoked outside an active request context
      dispatchEmail();
    }
  } else {
    await dispatchEmail();
  }

  return {
    updated: true,
    alreadyPaid: false,
  };
}
