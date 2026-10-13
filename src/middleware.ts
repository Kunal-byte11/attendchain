import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const PROTECTED_PREFIXES = [
  "/admin",
  "/teacher",
  "/student",
  "/corrections",
  "/settings",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedPage = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  const isProtectedApi =
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth/") &&
    !pathname.startsWith("/api/verify");

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const token = sessionCookie?.value;

  if (!token) {
    if (isProtectedApi) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required. Please sign in with SIWE.",
          },
        },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/auth", request.url);
    loginUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const session = await verifySessionToken(token);
  if (!session) {
    if (isProtectedApi) {
      return NextResponse.json(
        {
          error: {
            code: "SESSION_EXPIRED",
            message:
              "Session token invalid or expired. Please re-authenticate.",
          },
        },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/auth", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based route enforcement
  if (pathname.startsWith("/admin") && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/auth", request.url));
  }
  if (
    pathname.startsWith("/teacher") &&
    session.role !== "TEACHER" &&
    session.role !== "ADMIN"
  ) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }
  if (
    pathname.startsWith("/student") &&
    session.role !== "STUDENT" &&
    session.role !== "ADMIN"
  ) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/teacher/:path*",
    "/student/:path*",
    "/corrections/:path*",
    "/settings/:path*",
    "/api/:path*",
  ],
};
