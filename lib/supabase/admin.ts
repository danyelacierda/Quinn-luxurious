import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * SERVER-ONLY client authenticated with the service role key.
 * This bypasses Row Level Security entirely — only ever import this from
 * Server Actions or Route Handlers that have already verified (via the
 * regular server client + `users.role`) that the caller is an admin.
 *
 * Never import this into a Client Component or expose the key to the
 * browser — `server-only` above will throw a build error if you try.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
