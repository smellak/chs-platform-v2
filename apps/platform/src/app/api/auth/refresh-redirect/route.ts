import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import {
  generateAccessToken,
  generateRefreshToken,
  getAccessTokenCookieConfig,
  getRefreshTokenCookieConfig,
} from "@chs-platform/auth";
import { getDb, schema } from "@/lib/db";

/** Build correct base URL using Traefik's forwarded headers instead of internal 0.0.0.0:3000 */
function getExternalUrl(request: NextRequest, path: string): URL {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";

  if (forwardedHost) {
    return new URL(path, `${forwardedProto}://${forwardedHost}`);
  }
  return new URL(path, request.url);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/";
  const refreshTokenValue = request.cookies.get("chs_refresh_token")?.value;

  if (!refreshTokenValue) {
    return NextResponse.redirect(getExternalUrl(request, "/login"));
  }

  try {
    const db = getDb();

    // Find valid refresh token
    const tokens = await db
      .select()
      .from(schema.refreshTokens)
      .where(
        and(
          eq(schema.refreshTokens.token, refreshTokenValue),
          gt(schema.refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    const tokenRecord = tokens[0];
    if (!tokenRecord) {
      return NextResponse.redirect(getExternalUrl(request, "/login"));
    }

    // Find user
    const usersFound = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, tokenRecord.userId))
      .limit(1);

    const user = usersFound[0];
    if (!user || !user.isActive) {
      return NextResponse.redirect(getExternalUrl(request, "/login"));
    }

    // Delete old refresh token (rotation)
    await db
      .delete(schema.refreshTokens)
      .where(eq(schema.refreshTokens.id, tokenRecord.id));

    // Generate new tokens
    const newAccessToken = generateAccessToken({
      userId: user.id,
      orgId: user.orgId,
    });

    const newRefreshTokenValue = generateRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(schema.refreshTokens).values({
      userId: user.id,
      token: newRefreshTokenValue,
      expiresAt: refreshExpiresAt,
      lastAccessedAt: new Date(),
      userAgent: request.headers.get("user-agent"),
      ipAddress:
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip"),
    });

    // Get org domain for cookie
    const orgs = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, user.orgId))
      .limit(1);

    const envDomain = process.env["DOMAIN"];
    const isLocalhost =
      !envDomain || envDomain === "localhost" || envDomain === "";
    const orgDomain = isLocalhost ? undefined : (orgs[0]?.domain ?? undefined);

    // Sanitize returnTo to prevent open redirect
    const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/";
    const response = NextResponse.redirect(
      getExternalUrl(request, safeReturnTo),
    );

    const accessCookieConfig = getAccessTokenCookieConfig(orgDomain);
    const refreshCookieConfig = getRefreshTokenCookieConfig();

    response.cookies.set(accessCookieConfig.name, newAccessToken, {
      httpOnly: accessCookieConfig.httpOnly,
      secure: accessCookieConfig.secure,
      sameSite: accessCookieConfig.sameSite,
      path: accessCookieConfig.path,
      maxAge: accessCookieConfig.maxAge,
      ...(accessCookieConfig.domain
        ? { domain: accessCookieConfig.domain }
        : {}),
    });

    response.cookies.set(refreshCookieConfig.name, newRefreshTokenValue, {
      httpOnly: refreshCookieConfig.httpOnly,
      secure: refreshCookieConfig.secure,
      sameSite: refreshCookieConfig.sameSite,
      path: refreshCookieConfig.path,
      maxAge: refreshCookieConfig.maxAge,
    });

    // Signal cookie
    response.cookies.set("chs_session_active", "1", {
      httpOnly: false,
      secure:
        process.env["NODE_ENV"] === "production" &&
        process.env["DOMAIN"] !== "localhost",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
      ...(orgDomain ? { domain: orgDomain } : {}),
    });

    return response;
  } catch {
    return NextResponse.redirect(getExternalUrl(request, "/login"));
  }
}
