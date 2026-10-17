# Quinn Luxurious — Instructor Requirements & Security Audit

**Repository:** `Quinn-luxurious-instructor-fixes`  
**Git Branch:** `feature/instructor-checklist` (based on `main` @ `8cf4176`)  
**Audit Date:** October 17, 2026  
**Environment:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/Radix, Framer Motion, Clerk Auth, Supabase DB.

---

## 1. Executive Summary & Requirement Classification

| # | Requirement | Classification | Primary Files Affected | Summary of Current State & Planned Fix |
|---|-------------|----------------|------------------------|----------------------------------------|
| 1 | **Service Images** | **Missing** | `components/shared/ServiceCard.tsx`, `components/shared/ServicesGrid.tsx`, `components/booking/BookingFlow.tsx`, `lib/supabase/types.ts` | Services only use generic Lucide category icons; schema lacks image field. Propose additive migration for `services.image_url` and update cards/selectors with curated salon imagery and graceful fallbacks. |
| 2 | **Loading Indicators** | **Partially Implemented** | `components/booking/BookingFlow.tsx`, `components/shared/ServiceCard.tsx`, `components/account/AppointmentsList.tsx` | Confirm button has `isPending`, but service selection, service switching, and `/services` -> `/appointment` navigation lack transition indicators. Add progress feedback and disable duplicate submissions. |
| 3 | **Proper Calendar** | **Partially Implemented / Substandard** | `components/booking/BookingFlow.tsx`, `components/account/AppointmentsList.tsx` | Uses a 21-day horizontal scrolling strip (`nextNDays(21)`). Replace with an accessible monthly calendar grid respecting Manila timezone, business hours, and closed dates. |
| 4 | **Email Validation** | **Partially Implemented / Weak** | `lib/actions/booking.ts`, `components/booking/BookingFlow.tsx`, `components/shared/ContactForm.tsx` | Only uses HTML5 `type="email"` on client; server action only checks string presence without regex. Implement shared RFC-compliant regex on client and server. |
| 5 | **Customer Booking List & Mapping** | **Partially Implemented** | `components/account/AppointmentsList.tsx`, `app/account/page.tsx` | Client appointments list renders basic details, but lacks price breakdown and salon location/directions card (`siteConfig.address` in Butuan City). Enhance card mapping and add directions map link. |
| 6 | **Stripe Test-Mode Payments** | **Missing** | `lib/actions/booking.ts`, `components/booking/BookingFlow.tsx`, `app/api/checkout/stripe/route.ts`, `app/api/webhooks/stripe/route.ts` | Only manual Cash and QR Ph reference inputs exist. Dead PayMongo code remains in `booking.ts`. Add Stripe Checkout test mode with server-side webhook verification, preserving Cash/QR Ph. |
| 7 | **Admin Revenue Dashboard** | **Missing** | `components/admin/AdminDashboard.tsx`, `components/admin/AdminRevenueTab.tsx` | No revenue overview exists in admin dashboard. Build dedicated Revenue Tab aggregating only collected payments (`fully_paid`), filtering out unpaid/cancelled bookings, with timeframe filters. |
| 8 | **Admin Staff List** | **Partially Implemented** | `components/admin/AdminStaffTab.tsx` | Staff directory exists with name, role, bio, and activate/deactivate toggle, but lacks photo preview, appointment stats, or linked account info. |
| 9 | **Assign Staff to Bookings** | **Missing** | `components/admin/AdminAppointmentsTab.tsx`, `lib/actions/admin.ts` | Admin appointments tab displays staff name but provides no control to assign or reassign staff. Create `assignStaffToAppointment` action and select control. |
| 10 | **Staff Work List** | **Missing** | `app/staff/page.tsx`, `components/staff/StaffAppointmentsList.tsx`, `middleware.ts` | No dedicated `/staff` view exists. Staff members cannot log in to see only their assigned work. Build staff portal with server-side authorization. |
| 11 | **Delete Staff Account Guard** | **Missing** | `components/admin/AdminStaffTab.tsx`, `lib/actions/admin.ts` | No deletion workflow exists. Implement `deleteStaff` action: block deletion if upcoming appointments exist; nullify `staff_id` on historical past bookings to preserve business history. |
| 12 | **Staff Invitations** | **Missing** | `lib/actions/admin.ts`, `components/admin/AdminStaffTab.tsx` | No invite system exists. Implement Clerk-based staff invitation sending invitations with `publicMetadata: { role: 'staff' }` and profile pre-creation. |
| 13 | **Product Inventory Per Service** | **Missing** | `components/admin/AdminInventoryTab.tsx`, `supabase/migrations/` | No inventory tables or UI exist. Design additive schema for inventory items and service consumption; build admin management tab with low-stock warnings. |
| 14 | **Discount Banner Animation** | **Partially Implemented / Buggy** | `components/home/PromoBanner.tsx`, `components/shared/react-bits/ShinyText.tsx` | Banner uses `ShinyText` with text-wrapping glitches and 1s pause; banner itself is static. Rebuild into a continuous smooth ticker with reduced-motion accessibility. |

---

## 2. Security Vulnerabilities & Prioritized Fixes

### 1. `lib/supabase/server.ts` — Insecure Service-Role Key Abuse
- **Finding:** The server client unconditionally instantiates Supabase with `process.env.SUPABASE_SERVICE_ROLE_KEY!`. This bypasses Row Level Security on every server component and query, including public reads.
- **Risk:** Sensitive customer data or private columns can leak if queries omit explicit where-clauses.
- **Fix:** Separate public data queries to use `NEXT_PUBLIC_SUPABASE_ANON_KEY`, reserving the service-role client strictly for privileged server actions in `lib/supabase/admin.ts`.

### 2. `lib/actions/account.ts` — Critical IDOR on Appointment Modification
- **Finding:** `cancelAppointment(appointmentId)` and `rescheduleAppointment(appointmentId, ...)` execute direct `update` statements by ID without checking whether the requesting user owns the appointment or has staff/admin permissions.
- **Risk:** Any user or anonymous caller who guesses or intercepts an `appointmentId` can cancel or alter any booking in the database.
- **Fix:** Obtain current authenticated user via `auth()`, verify `customer_id === user.id` (or caller is admin/staff), and abort with 403 if unauthorized.

### 3. `middleware.ts` — Inadequate `/admin` Protection
- **Finding:** Middleware checks `if (isAdminRoute(req) && !userId)` redirecting to `/login`. Once signed in, any customer account is allowed through into `/admin`.
- **Risk:** Unauthorized clients can view admin route scaffolding.
- **Fix:** Inspect user role claim (`metadata.role === 'admin'`) in middleware and redirect non-admins to `/`.

### 4. `lib/auth.ts` — Hardcoded Environment Variable vs RBAC
- **Finding:** `requireAdmin()` only compares email against `process.env.ADMIN_EMAILS`. It has no staff checking mechanism or integration with Clerk roles.
- **Fix:** Implement robust role helpers: `requireAdmin()`, `requireStaff()`, and `requireStaffOrAdmin()` checking both Clerk session claims and email fallback.

### 5. `lib/actions/booking.ts` — Server-Side Validation & Legacy Code
- **Finding:** No email regex validation on the server; field lengths are unconstrained; dead PayMongo cleanup code runs on every booking attempt.
- **Fix:** Add strict email regex, field constraints, honeypot protection, Manila time-of-day checks, and clean up abandoned PayMongo routines.

---

## 3. Database Drift & Migration Safety Analysis

### Observed Live Schema Differences
The connected Supabase database includes tables and columns not represented in the repository's initial migration:
- `business_hours`
- `closed_dates`
- `special_business_hours`
- `staff_schedules`
- `staff_time_blocks`
- Extra appointment columns: `expected_deposit`, `expected_balance`, `balance_paid`, `admin_notes`, `payment_method`, `payment_reference`.

### Migration Strategy
- **Rule:** Do NOT run destructive migrations, drop columns, or overwrite live schema.
- **Rule:** Do NOT run `supabase db push` against production.
- **Action:** Prepare additive, review-only SQL migration files:
  1. `add_service_image_url.sql` (adds `image_url text` to `services`).
  2. `add_inventory_schema.sql` (creates `inventory_items` and `service_product_usage`).
- Provide fallback mock data and graceful schema degradation in the application code so the app functions seamlessly whether or not the migration has been applied.

---

## 4. Implementation Plan & Execution Sequence

1. **Step 1: Security Hardening**
   - Fix `lib/supabase/server.ts` and separate service-role usage.
   - Patch IDOR in `lib/actions/account.ts`.
   - Update `lib/auth.ts` and `middleware.ts` for Admin and Staff role protection.
   - Add server validation, email regex, and Manila time checks in `lib/actions/booking.ts`.

2. **Step 2: Customer Experience Enhancements**
   - Add service images to cards, grids, and booking service selector (Req 1).
   - Implement loading indicators on service navigation and selection (Req 2).
   - Build accessible monthly calendar grid replacing horizontal date strip (Req 3).
   - Implement strict email regex validation on client and server (Req 4).
   - Enhance customer appointments list with full card mapping and salon location/directions (Req 5).
   - Rebuild continuous animated discount banner with reduced-motion support (Req 14).

3. **Step 3: Payments & Admin/Staff Portals**
   - Integrate Stripe test-mode Checkout with webhook verification alongside Cash & QR Ph (Req 6).
   - Add Admin Revenue Dashboard tab with collected revenue calculations and filters (Req 7).
   - Enhance Admin Staff Tab (Req 8).
   - Implement Admin Staff Assignment on appointments (Req 9).
   - Build Staff Portal (`/staff`) for assigned bookings (Req 10).
   - Implement safe Staff Deletion with upcoming appointment blocker (Req 11).
   - Implement Staff Invitations via Clerk (Req 12).
   - Design Inventory system with Admin Tab and additive schema proposal (Req 13).

4. **Step 4: Quality Verification**
   - Run typecheck, linting, and build verification (`npm run build`).
   - Run unit test suites.
   - Inspect git diff ensuring zero secrets and clean commits on `feature/instructor-checklist`.
