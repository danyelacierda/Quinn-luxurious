export type AppUserRole = "admin" | "staff" | "customer";

/**
 * Normalizes email address for reliable case-insensitive comparisons.
 */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Returns true if the provided email matches any configured admin email in ADMIN_EMAILS.
 * Strictly requires the email to be verified.
 */
export function isConfiguredAdminEmail(
  email: string | null | undefined,
  isVerified = true,
  adminEmailsEnv = process.env.ADMIN_EMAILS
): boolean {
  if (!email || !isVerified) return false;
  if (!adminEmailsEnv || adminEmailsEnv.trim() === "") return false;

  const allowedEmails = adminEmailsEnv
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);

  return allowedEmails.includes(normalizeEmail(email));
}

export interface ResolveRoleParams {
  sessionRole?: string | null;
  metadataRole?: string | null;
  primaryEmail?: { emailAddress: string; isVerified: boolean } | null;
  adminEmailsEnv?: string;
}

/**
 * Pure authorization policy function:
 * Resolves the user's role from trusted server claims, server metadata, and verified emails.
 * Never trusts user-controlled unsafeMetadata.
 */
export function resolveUserRole({
  sessionRole,
  metadataRole,
  primaryEmail,
  adminEmailsEnv = process.env.ADMIN_EMAILS,
}: ResolveRoleParams): AppUserRole {
  // 1. Check custom session token claim if present
  if (sessionRole === "admin") return "admin";
  if (sessionRole === "staff") return "staff";

  // 2. Check server-controlled publicMetadata role
  if (metadataRole === "admin") return "admin";
  if (metadataRole === "staff") return "staff";

  // 3. Check verified email against ADMIN_EMAILS
  if (
    primaryEmail &&
    primaryEmail.isVerified &&
    isConfiguredAdminEmail(primaryEmail.emailAddress, true, adminEmailsEnv)
  ) {
    return "admin";
  }

  return "customer";
}

/**
 * Pure IDOR ownership & authorization policy function:
 * Directly tested by unit tests and used in server actions.
 */
export function isAuthorizedToManageAppointment(
  caller: { userId: string | null; role: AppUserRole | null },
  appointmentCustomerId: string | null
): boolean {
  if (!caller.userId) return false;

  // Staff and Admins can manage any appointment
  if (caller.role === "admin" || caller.role === "staff") {
    return true;
  }

  // Customer can only manage their own appointment
  if (appointmentCustomerId && caller.userId === appointmentCustomerId) {
    return true;
  }

  return false;
}

export interface SuccessPageAuthParams {
  caller: {
    userId: string | null;
    role: AppUserRole | null;
  };
  appointment: {
    id: string;
    customer_id: string | null;
  };
  verifiedStripeSessionMatches?: boolean;
}

export interface SuccessPageAuthResult {
  isAuthorized: boolean;
  reason: "owner" | "staff_admin" | "verified_stripe_session" | "unauthorized";
}

/**
 * Pure authorization policy function for viewing appointment success / confirmation:
 * Enforces strict reservation ownership while safely allowing:
 * 1. The appointment owner when signed in.
 * 2. Authorized staff and admin members.
 * 3. The customer who holds a verified, paid Stripe session matching this appointment.
 *
 * Never allows access merely because someone knows an appointment ID.
 */
export function isAuthorizedToViewSuccessPage({
  caller,
  appointment,
  verifiedStripeSessionMatches = false,
}: SuccessPageAuthParams): SuccessPageAuthResult {
  // 1. Staff and Admins can view any reservation
  if (caller.userId && (caller.role === "admin" || caller.role === "staff")) {
    return { isAuthorized: true, reason: "staff_admin" };
  }

  // 2. Verified Stripe checkout session payer (holds cryptographic session token matching this reservation)
  if (verifiedStripeSessionMatches) {
    return { isAuthorized: true, reason: "verified_stripe_session" };
  }

  // 3. Appointment owner when signed in
  if (caller.userId && appointment.customer_id && caller.userId === appointment.customer_id) {
    return { isAuthorized: true, reason: "owner" };
  }

  // 4. Default deny: anonymous or unrelated visitors with just an appointment ID are blocked
  return { isAuthorized: false, reason: "unauthorized" };
}
