import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import type { Database } from "@/lib/supabase/types";

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && anonKey && !url.includes("placeholder") && !anonKey.includes("placeholder"));
}

/**
 * Standard server-side Supabase client for normal user and public operations.
 * Uses NEXT_PUBLIC_SUPABASE_ANON_KEY and attaches the Clerk auth session token
 * where available. Row Level Security (RLS) is fully active and respected.
 *
 * For privileged administrative operations, use `createAdminClient()` from
 * `@/lib/supabase/admin` inside server actions that have explicitly checked
 * `requireAdmin()`.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  return createSupabaseClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: async (input, init = {}) => {
        try {
          const { getToken } = await auth();
          const token = await getToken({ template: "supabase" }).catch(() => null);
          if (token) {
            init.headers = {
              ...init.headers,
              Authorization: `Bearer ${token}`,
            };
          }
        } catch {
          // If unauthenticated or token template not configured, falls back to anon key
        }
        return fetch(input, init);
      },
    },
  });
}
