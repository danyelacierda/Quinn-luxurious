import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/nextjs";
import type { Database } from "@/lib/supabase/types";
import { useMemo } from "react";

export function useSupabaseClient() {
  const { getToken } = useAuth();
  
  return useMemo(() => {
    return createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        accessToken: async () => {
          return (await getToken()) ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        },
      }
    );
  }, [getToken]);
}
