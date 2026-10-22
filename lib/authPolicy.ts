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
