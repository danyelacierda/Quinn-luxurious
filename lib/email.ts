import nodemailer from "nodemailer";
import { formatPHP } from "@/lib/format";

// Simple HTML escape function to sanitize text
function escapeHtml(unsafe: string) {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendBookingConfirmationEmail({
  customerEmail,
  customerName,
  serviceName,
  date,
  time,
  phone,
  price,
  paymentMethod,
  paymentReference,
}: {
  customerEmail: string;
  customerName: string;
  serviceName: string;
  date: string;
  time: string;
  phone?: string;
  price?: number;
  paymentMethod?: string;
  paymentReference?: string | null;
}) {
  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error("GMAIL_USER or GMAIL_APP_PASSWORD is not set. Email not sent.");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });

    const safeCustomerName = escapeHtml(customerName);
    const safeServiceName = escapeHtml(serviceName);
    const safeDate = escapeHtml(date);
    const safeTime = escapeHtml(time);

    let paymentInfoHtml = "";
    if (paymentMethod === "qr_ph") {
      paymentInfoHtml = `<p><strong>Payment:</strong> QR Ph payment, reference ${escapeHtml(paymentReference || "N/A")}, awaiting confirmation</p>`;
    } else if (paymentMethod === "cash") {
      paymentInfoHtml = `<p><strong>Payment:</strong> Pay at the salon</p>`;
    }

    // Send admin notification if ADMIN_NOTIFY_EMAIL is set
    const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL;
    if (ADMIN_NOTIFY_EMAIL) {
      try {
        const formattedPrice = price !== undefined ? formatPHP(price) : "N/A";
        
        const adminHtml = `
          <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px;">
            <h2>New Booking Created</h2>
            <p><strong>Customer Name:</strong> ${safeCustomerName}</p>
            <p><strong>Phone:</strong> ${escapeHtml(phone || "N/A")}</p>
            <p><strong>Service:</strong> ${safeServiceName}</p>
            <p><strong>Date:</strong> ${safeDate}</p>
            <p><strong>Time:</strong> ${safeTime}</p>
            <p><strong>Price:</strong> ${formattedPrice}</p>
            <p><strong>Payment Method:</strong> ${escapeHtml(paymentMethod || "N/A")}</p>
            <p><strong>Payment Reference:</strong> ${escapeHtml(paymentReference || "N/A")}</p>
          </div>
        `;

        const adminMailOptions = {
          from: `"Quinn Luxurious" <${GMAIL_USER}>`,
          to: ADMIN_NOTIFY_EMAIL,
          replyTo: customerEmail,
          subject: "New Booking Alert!",
          html: adminHtml,
        };

        const adminInfo = await transporter.sendMail(adminMailOptions);
        console.log("Admin email sent: " + adminInfo.messageId);
      } catch (adminError) {
        console.error("Failed to send admin email:", adminError);
      }
    }

    const customerHtml = `
      <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px; border: 1px solid #E7C7C2; border-radius: 12px;">
        <h2 style="color: #4A4A4A;">Appointment Confirmed!</h2>
        <p>Hi ${safeCustomerName},</p>
        <p>Thank you for booking with Quinn Luxurious. We can't wait to see you!</p>
        <div style="background-color: #FBF6EF; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Service:</strong> ${safeServiceName}</p>
          <p style="margin: 5px 0 0 0;"><strong>Date:</strong> ${safeDate}</p>
          <p style="margin: 5px 0 0 0;"><strong>Time:</strong> ${safeTime}</p>
          ${paymentInfoHtml}
        </div>
        <p>If you need to reschedule or cancel, please contact us.</p>
        <p>Best,<br>Quinn Luxurious Studio</p>
      </div>
    `;

    const customerMailOptions = {
      from: `"Quinn Luxurious" <${GMAIL_USER}>`,
      to: customerEmail,
      subject: "Your Appointment is Confirmed!",
      html: customerHtml,
    };

    try {
      const info = await transporter.sendMail(customerMailOptions);
      console.log("Customer email sent: " + info.messageId);
      return info;
    } catch (customerError) {
      console.error("Failed to send customer email:", customerError);
    }

  } catch (error) {
    console.error("Failed to setup email transporter:", error);
  }
}
