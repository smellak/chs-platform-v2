import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  getAccessTokenCookieConfig,
  getRefreshTokenCookieConfig,
} from "@aleph/auth";
import { getDb, schema } from "@/lib/db";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Nombre de usuario y contraseña son requeridos" },
        { status: 400 },
      );
    }

    const { username, password } = parsed.data;
    const db = getDb();

    // Find user by username (get first org's user for now)
    const usersFound = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    const user = usersFound[0];
    if (!user) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Cuenta desactivada. Contacte al administrador." },
        { status: 403 },
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 },
      );
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      orgId: user.orgId,
    });

    const refreshTokenValue = generateRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Store refresh token
    await db.insert(schema.refreshTokens).values({
      userId: user.id,
      token: refreshTokenValue,
      expiresAt: refreshExpiresAt,
    });

    // Update last login
    await db
      .update(schema.users)
      .set({ lastLogin: new Date() })
      .where(eq(schema.users.id, user.id));

    // Log activity
    await db.insert(schema.activityLogs).values({
      orgId: user.orgId,
      userId: user.id,
      action: "auth.login",
      details: { username: user.username },
      ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
    });

    // Get user departments
    const deptRoles = await db
      .select({
        departmentId: schema.userDepartmentRoles.departmentId,
        departmentName: schema.departments.name,
        departmentSlug: schema.departments.slug,
        departmentIcon: schema.departments.icon,
        departmentColor: schema.departments.color,
        roleId: schema.userDepartmentRoles.roleId,
        roleName: schema.roles.name,
        roleSlug: schema.roles.slug,
      })
      .from(schema.userDepartmentRoles)
      .innerJoin(
        schema.departments,
        eq(schema.userDepartmentRoles.departmentId, schema.departments.id),
      )
      .innerJoin(
        schema.roles,
        eq(schema.userDepartmentRoles.roleId, schema.roles.id),
      )
      .where(eq(schema.userDepartmentRoles.userId, user.id));

    // Get org domain for cookie
    const orgs = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, user.orgId))
      .limit(1);

    // Only set cookie domain in production with a real domain (not localhost)
    const envDomain = process.env["DOMAIN"];
    const isLocalhost = !envDomain || envDomain === "localhost" || envDomain === "";
    const orgDomain = isLocalhost ? undefined : (orgs[0]?.domain ?? undefined);

    // Build response
    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        isActive: user.isActive,
        isSuperAdmin: user.isSuperAdmin,
        departments: deptRoles,
      },
    });

    // Set cookies
    const accessCookieConfig = getAccessTokenCookieConfig(orgDomain);
    const refreshCookieConfig = getRefreshTokenCookieConfig();

    response.cookies.set(accessCookieConfig.name, accessToken, {
      httpOnly: accessCookieConfig.httpOnly,
      secure: accessCookieConfig.secure,
      sameSite: accessCookieConfig.sameSite,
      path: accessCookieConfig.path,
      maxAge: accessCookieConfig.maxAge,
      ...(accessCookieConfig.domain ? { domain: accessCookieConfig.domain } : {}),
    });

    response.cookies.set(refreshCookieConfig.name, refreshTokenValue, {
      httpOnly: refreshCookieConfig.httpOnly,
      secure: refreshCookieConfig.secure,
      sameSite: refreshCookieConfig.sameSite,
      path: refreshCookieConfig.path,
      maxAge: refreshCookieConfig.maxAge,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
