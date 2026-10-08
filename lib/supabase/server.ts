import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";

/**
 * Supabase client for use in Server Components, Server Actions, and Route
 * Handlers. Reads the session from the incoming request's cookies and
 * (when called from a Server Action or Route Handler) can refresh them.
 *
 * Server Components can only READ cookies — the try/catch below absorbs
 * the "cannot set cookies from a Server Component" error, which is safe
 * because `middleware.ts` is already responsible for refreshing the
 * session on every request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore, see comment above.
          }
        },
      },
    }
  );
}
