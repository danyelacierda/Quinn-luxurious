import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const isAccountRoute = createRouteMatcher(["/account(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, getToken } = await auth();
  const path = req.nextUrl.pathname;

  if ((isAccountRoute(req) || isAdminRoute(req)) && !userId) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }

  if (isAdminRoute(req) && userId) {
    const token = await getToken();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );
    const { data: profile } = await supabase.from("users").select("role").eq("id", userId).single();
    if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }
});

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)", 
    "/", 
    "/(api|trpc)(.*)",
    "/__clerk/:path*"
  ],
};
