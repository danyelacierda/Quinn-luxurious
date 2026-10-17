import { auth, currentUser } from "@clerk/nextjs/server";
import {
  type AppUserRole,
  resolveUserRole,
  isAuthorizedToManageAppointment,
} from "./authPolicy";

export * from "./authPolicy";

/**
 * Extracts the user's role from Clerk session claims or publicMetadata.
 * Prioritizes admin if email is verified and matches ADMIN_EMAILS.
 */
export async function getCurrentUserRole(): Promise<AppUserRole | null> {
  try {
    const { sessionClaims, userId } = await auth();
    if (!userId) return null;

    const sessionRole = (sessionClaims as { metadata?: { role?: string } })?.metadata?.role;
    const user = await currentUser();

    const metadataRole = (user?.publicMetadata as { role?: string })?.role;
    const primaryEmailObj = user?.emailAddresses?.find(
      (e) => e.id === user?.primaryEmailAddressId
    );

    const primaryEmail = primaryEmailObj
      ? {
          emailAddress: primaryEmailObj.emailAddress,
          isVerified: primaryEmailObj.verification?.status === "verified",
        }
      : null;

    return resolveUserRole({
      sessionRole,
      metadataRole,
      primaryEmail,
    });
  } catch (err) {
    console.error("getCurrentUserRole error:", err);
    return null;
  }
}

/**
 * Server-side guard: Returns true if the current user has the admin role
 * or is listed in the verified ADMIN_EMAILS environment variable.
 */
export async function requireAdmin(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role === "admin";
}

/**
 * Server-side guard: Returns true if the current user is a staff member or admin.
 */
export async function requireStaff(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role === "staff" || role === "admin";
}

export const requireStaffOrAdmin = requireStaff;

/**
 * IDOR Ownership Guard:
 * Returns true if the current user owns the appointment (customer_id matches)
 * OR is an authorized staff/admin member.
 */
export async function canManageAppointment(appointmentCustomerId: string | null): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;

  const role = await getCurrentUserRole();
  return isAuthorizedToManageAppointment({ userId, role }, appointmentCustomerId);
}
