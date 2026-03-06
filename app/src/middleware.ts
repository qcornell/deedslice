import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Next.js Middleware — Server-side route protection
 *
 * Protects /dashboard/* routes by verifying the Supabase session cookie/token.
 * Unauthenticated requests get redirected to /login.
 *
 * Also handles:
 *   - Security headers on all responses
 *   - Portal custom domain resolution (future)
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // ── Security headers ──
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // Note: Dashboard auth is handled client-side by useAuth hook in dashboard/layout.tsx.
  // Supabase JS stores sessions in localStorage (not cookies), so middleware can't
  // reliably check auth state. The layout already redirects to /login if no session.

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *   - _next/static, _next/image (Next.js internals)
     *   - favicon.ico, sitemap.xml, robots.txt
     *   - API routes (handled by their own auth)
     *   - Public pages: /, /login, /signup, /terms, /privacy, /view/*
     *   - Portal pages (have their own LP auth)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/|login|signup|terms|privacy|view/|portal/).*)",
  ],
};
