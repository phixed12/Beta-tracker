import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

export const proxy = auth(function proxyHandler(req: NextAuthRequest) {
  const { pathname } = req.nextUrl;

  // Always allow NextAuth routes, static assets, and Next.js internals
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const session = req.auth;

  // For API routes: unauthenticated → 401 JSON (not redirect)
  if (pathname.startsWith("/api/")) {
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // For page routes: unauthenticated → redirect to sign-in
  if (!session) {
    const signIn = new URL("/api/auth/signin", req.url);
    signIn.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
