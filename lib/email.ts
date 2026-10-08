import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendBookingConfirmationEmail({
  customerEmail,
  customerName,
  serviceName,
  date,
  time,
}: {
  customerEmail: string;
  customerName: string;
  serviceName: string;
  date: string;
  time: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is not set. Email not sent.");
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "Quinn Luxurious <onboarding@resend.dev>",
      to: [customerEmail],
      subject: "Your Appointment is Confirmed!",
      html: `
        <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px; border: 1px solid #E7C7C2; border-radius: 12px;">
          <h2 style="color: #4A4A4A;">Appointment Confirmed!</h2>
          <p>Hi ${customerName},</p>
          <p>Thank you for booking with Quinn Luxurious. We can't wait to see you!</p>
          <div style="background-color: #FBF6EF; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Service:</strong> ${serviceName}</p>
            <p style="margin: 5px 0 0 0;"><strong>Date:</strong> ${date}</p>
            <p style="margin: 5px 0 0 0;"><strong>Time:</strong> ${time}</p>
          </div>
          <p>If you need to reschedule or cancel, please contact us.</p>
          <p>Best,<br>Quinn Luxurious Studio</p>
        </div>
      `,
    });

    console.log("=== RESEND API RESPONSE ===");
    console.log("Data:", data);
    console.log("Error:", error);

    if (error) {
      console.error("Error sending email:", error);
    }
    
    return data;
  } catch (error) {
    console.error("Failed to send email catch block:", error);
  }
}
