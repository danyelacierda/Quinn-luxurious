# Quinn Luxurious — Staff & Admin Management Setup Guide

This guide documents the architecture, business rules, and required configuration for **Step 4: Staff and Admin Management**.

---

## 1. Staff Identity & Account Linking Architecture

### Critical Security Rule:
In this architecture, **Clerk User IDs** (`user_...`) and **Staff Table IDs** (UUIDs) are **not interchangeable**:
- `staff.id` (UUID): Primary key identifying the staff profile (e.g. Maria Santos, Stylist). This is referenced by `appointments.staff_id`.
- `staff.user_id` (String | null): Foreign link to the authenticated Clerk user identity (`users.id`).
- `users.role`: Must be `'staff'` or `'admin'` for staff portal access.

### Linking Workflow:
1. **Admin Invites Staff:** Admin enters staff member's email, name, and role title in the **Admin Staff Tab** (`/admin`).
2. **Clerk Invitation:** Server calls `clerkClient.invitations.createInvitation` with:
   - `emailAddress`: Staff member's email.
   - `redirectUrl`: `https://yourdomain.com/staff`.
   - `publicMetadata`: `{ role: "staff", staff_id: "<staff_uuid>" }`.
3. **Onboarding Sign Up:** When the staff member clicks the email invitation link and registers with Clerk, their account is initialized with `role: "staff"`.
4. **Auto-Link via Webhook or Login:** When the staff member signs in to `/staff`, their Clerk user ID is resolved and linked to `staff.user_id`.

---

## 2. Admin Revenue Dashboard Business Rules

Financial totals are calculated dynamically from authoritative database records in `lib/revenue.ts` (`calculateRevenueMetrics`):

1. **Realized / Paid Revenue:**
   - **Condition:** `payment_status === "fully_paid"` AND `status !== "cancelled"`.
   - **Source:** Authoritative service price `services.price` (or recorded `balance_paid`).
   - Captures settled Stripe payments, admin-confirmed QR Ph payments, and salon-collected cash.
2. **Pending Revenue:**
   - **Condition:** `payment_status in ("pending", "pending_payment")` AND `status !== "cancelled"`.
   - Captures bookings awaiting payment confirmation or open Stripe checkouts.
3. **Unpaid In-Salon Cash:**
   - **Condition:** `payment_method === "cash"` AND `payment_status === "unpaid"` AND `status in ("confirmed", "completed")`.
   - Tracked as cash receivables expected at the salon.
4. **Cancelled / Lost Volume:**
   - **Condition:** `status === "cancelled"`.
   - Strictly isolated and excluded from realized/pending revenue totals.
5. **No Double Counting:**
   - Every appointment record belongs to exactly one primary revenue status bucket using strict precedence.

---

## 3. Appointment Assignment & Scheduling Conflict Detection

Admins can assign or reassign any appointment to an active staff member in the **Admin Appointments Tab**:
- **Server Guard:** Guarded by `requireAdmin()`.
- **Active Validation:** Rejects inactive staff assignments with `Cannot assign: Staff member is currently inactive.`
- **Conflict Detection:** Queries whether the selected staff member already has an active booking (`confirmed`, `pending`, `pending_payment`) on the exact same `appointment_date` and `appointment_time`. If so, the assignment is rejected with an inline conflict alert.

---

## 4. Protected Staff Portal (`/staff`)

- **Route:** `/staff`
- **Authorization:** Guarded by Clerk middleware and server-side `getCurrentUserRole()`. Normal customers cannot access this route.
- **Strict Data Isolation:**
  - The query `getStaffAppointments()` strictly queries appointments where `appointments.staff_id === staffRecord.id`.
  - Zero URL parameter trust: Staff cannot view another staff member's bookings by tampering with URLs or request parameters.
- **Allowed Staff Actions:**
  - View upcoming and daily assigned appointments.
  - View customer name, phone, email, service details, and notes.
  - Action: `markAppointmentCompletedByStaff(appointmentId)`. The server strictly verifies that `appointment.staff_id === staffRecord.id` before allowing status to update to `"completed"`.

---

## 5. Safe Staff Removal Safeguards (Instructor Rule #11)

Implemented in `lib/actions/admin.ts` (`deleteStaffMember`):
1. **Upcoming Booking Check:** Checks for active appointments (`status in ("confirmed", "pending", "pending_payment")` and `appointment_date >= todayManila`).
2. **Blocked if Upcoming:** If upcoming active bookings exist, deletion is **BLOCKED**:
   `Cannot delete staff member with X upcoming appointment(s). Please reassign or cancel their upcoming appointments first.`
3. **Safe Historical Unlink:** If no upcoming bookings exist, past and cancelled appointments have their `staff_id` updated to `null` so customer appointment records and salon booking history are never broken or deleted.
4. **Role Reversion:** If the staff member had a linked Clerk user in `users`, their role is reverted to `"customer"`.

---

## 6. Manual Clerk Dashboard Setup Checklist

If you are configuring Clerk production or staging:
1. **Enable Invitations:** In Clerk Dashboard -> **User & Authentication** -> **Restrictions** -> ensure **Invitations** are enabled.
2. **Environment Variables:**
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...`
   - `CLERK_SECRET_KEY=sk_test_...`
   - `ADMIN_EMAILS=admin@example.com,owner@quinnluxurious.com`
3. **Session Token Metadata (Optional):** In Clerk Dashboard -> **Sessions** -> **Customize session token**, add:
   ```json
   {
     "metadata": {
       "role": "{{user.public_metadata.role}}"
     }
   }
   ```
