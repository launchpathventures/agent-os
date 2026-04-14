/**
 * Ditto — Workspace Auth Middleware (Brief 143)
 *
 * Checks for `ditto_workspace_session` cookie on workspace routes.
 * Redirects to /login if missing. Allows public routes through:
 * - /welcome, /welcome/* — public front door
 * - /chat, /chat/* — has its own auth (Brief 123)
 * - /login, /login/* — login flow itself
 * - /admin, /admin/* — has its own auth (Brief 090)
 * - /api/v1/network/* — Bearer token auth (Brief 088)
 * - /api/v1/chat/* — cookie auth (Brief 123)
 * - /api/v1/workspace/request-link — must be accessible to send magic link
 * - /setup — initial setup page
 * - /_next/*, /favicon.ico, etc. — static assets
 *
 * When WORKSPACE_OWNER_EMAIL is not set (local dev), all routes pass through
 * without auth (AC11).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const WORKSPACE_SESSION_COOKIE = "ditto_workspace_session";

/** Verify HMAC-signed session cookie (Edge-compatible via Web Crypto API). */
async function verifySessionCookie(cookieValue: string, ownerEmail: string): Promise<boolean> {
  const sepIdx = cookieValue.lastIndexOf("|");
  if (sepIdx === -1) {
    // Legacy unsigned cookie — treat as email-only (backwards compat for existing sessions)
    return cookieValue.toLowerCase() === ownerEmail.toLowerCase();
  }
  const email = cookieValue.substring(0, sepIdx);
  const sig = cookieValue.substring(sepIdx + 1);
  if (email.toLowerCase() !== ownerEmail.toLowerCase()) return false;

  const secret = process.env.SESSION_SECRET || process.env.WORKSPACE_OWNER_EMAIL || "ditto-workspace";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(email.toLowerCase()));
  const expectedSig = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
  return sig === expectedSig;
}

/** Routes that are always accessible without workspace auth. */
const PUBLIC_PREFIXES = [
  "/welcome",
  "/chat",
  "/login",
  "/admin",
  "/setup",
  "/api/v1/network",
  "/api/v1/chat",
  "/api/v1/voice",
  "/api/v1/workspace/request-link",
  "/api/v1/workspace/session",
  "/_next",
  "/favicon",
  "/review",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // AC11: No WORKSPACE_OWNER_EMAIL = local dev, skip auth entirely
  if (!process.env.WORKSPACE_OWNER_EMAIL) {
    return NextResponse.next();
  }

  // Allow public routes through
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Allow static files
  if (pathname.includes(".") && !pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Check workspace session cookie — HMAC-signed value verified against owner email
  const sessionCookie = request.cookies.get(WORKSPACE_SESSION_COOKIE);
  if (
    sessionCookie?.value &&
    await verifySessionCookie(sessionCookie.value, process.env.WORKSPACE_OWNER_EMAIL!)
  ) {
    return NextResponse.next();
  }

  // No session — redirect to login
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
