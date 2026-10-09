import { currentUser } from "@clerk/nextjs/server";

export async function requireAdmin(): Promise<boolean> {
  const adminEmailsEnv = process.env.ADMIN_EMAILS;
  if (!adminEmailsEnv || adminEmailsEnv.trim() === "") {
    return false; // Fail closed if missing or empty
  }

  const allowedEmails = adminEmailsEnv
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowedEmails.length === 0) {
    return false;
  }

  const user = await currentUser();
  if (!user) {
    return false;
  }

  const primaryEmail = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId
  );

  if (!primaryEmail || primaryEmail.verification?.status !== "verified") {
    return false;
  }

  const userEmail = primaryEmail.emailAddress.trim().toLowerCase();
  return allowedEmails.includes(userEmail);
}
