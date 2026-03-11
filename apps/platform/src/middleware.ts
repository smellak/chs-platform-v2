import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

export const runtime = "experimental-edge";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/refresh-redirect",
  "/api/auth/token-status",
  "/api/auth/verify-access",
  "/api/auth/sso-info",
  "/api/health",
];

async function verifyToken(
  token: string,
): Promise<{ userId: string; orgId: string } | null> {
  try {
    const secret = process.env["JWT_SECRET"];
    if (!secret) return null;

    const encoder = new TextEncoder();
    const { payload } = await jwtVerify(token, encoder.encode(secret), {
      algorithms: ["HS256"],
    });

    if (
      typeof payload["userId"] === "string" &&
      typeof payload["orgId"] === "string"
    ) {
      return { userId: payload["userId"], orgId: payload["orgId"] };
    }
    return null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("chs_access_token")?.value;
  const sessionActive = request.cookies.get("chs_session_active")?.value;

  if (!token) {
    if (sessionActive === "1" && !pathname.startsWith("/api/")) {
      // User has a session but access token missing — attempt silent refresh
      const refreshUrl = new URL("/api/auth/refresh-redirect", request.url);
      refreshUrl.searchParams.set("returnTo", pathname + request.nextUrl.search);
      return NextResponse.redirect(refreshUrl);
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    if (sessionActive === "1" && !pathname.startsWith("/api/")) {
      // Token expired but session exists — attempt silent refresh
      const refreshUrl = new URL("/api/auth/refresh-redirect", request.url);
      refreshUrl.searchParams.set("returnTo", pathname + request.nextUrl.search);
      return NextResponse.redirect(refreshUrl);
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-chs-user-id", payload.userId);
  requestHeaders.set("x-chs-org-id", payload.orgId);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
