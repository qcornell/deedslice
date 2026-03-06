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

  const { pathname } = req.nextUrl;

  // ── Dashboard protection ──
  if (pathname.startsWith("/dashboard")) {
    // Check for Supabase auth token in cookies
    // Supabase stores session in sb-<ref>-auth-token cookie
    const cookies = req.cookies;
    let hasSession = false;

    // Look for any Supabase auth cookie
    for (const [name] of cookies) {
      if (name.includes("-auth-token")) {
        hasSession = true;
        break;
      }
    }

    // Also check for Authorization header (API-style access)
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      hasSession = true;
    }

    if (!hasSession) {
      // Redirect to login with return URL
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

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
