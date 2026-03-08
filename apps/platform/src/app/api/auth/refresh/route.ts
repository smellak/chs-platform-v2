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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const refreshTokenValue = request.cookies.get("chs_refresh_token")?.value;

    if (!refreshTokenValue) {
      return NextResponse.json({ error: "No refresh token" }, { status: 401 });
    }

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
      return NextResponse.json({ error: "Refresh token inválido o expirado" }, { status: 401 });
    }

    // Find user
    const usersFound = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, tokenRecord.userId))
      .limit(1);

    const user = usersFound[0];
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Usuario no encontrado o inactivo" }, { status: 401 });
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
    });

    // Get org domain
    const orgs = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, user.orgId))
      .limit(1);

    const orgDomain = orgs[0]?.domain ?? undefined;

    const response = NextResponse.json({ ok: true });

    const accessCookieConfig = getAccessTokenCookieConfig(orgDomain);
    const refreshCookieConfig = getRefreshTokenCookieConfig();

    response.cookies.set(accessCookieConfig.name, newAccessToken, {
      httpOnly: accessCookieConfig.httpOnly,
      secure: accessCookieConfig.secure,
      sameSite: accessCookieConfig.sameSite,
      path: accessCookieConfig.path,
      maxAge: accessCookieConfig.maxAge,
      ...(accessCookieConfig.domain ? { domain: accessCookieConfig.domain } : {}),
    });

    response.cookies.set(refreshCookieConfig.name, newRefreshTokenValue, {
      httpOnly: refreshCookieConfig.httpOnly,
      secure: refreshCookieConfig.secure,
      sameSite: refreshCookieConfig.sameSite,
      path: refreshCookieConfig.path,
      maxAge: refreshCookieConfig.maxAge,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
