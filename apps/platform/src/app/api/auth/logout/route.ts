import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const refreshTokenValue = request.cookies.get("aleph_refresh_token")?.value;
    const userId = request.headers.get("x-aleph-user-id");
    const orgId = request.headers.get("x-aleph-org-id");

    const db = getDb();

    if (refreshTokenValue) {
      await db
        .delete(schema.refreshTokens)
        .where(eq(schema.refreshTokens.token, refreshTokenValue));
    }

    if (userId && orgId) {
      await db.insert(schema.activityLogs).values({
        orgId,
        userId,
        action: "auth.logout",
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
      });
    }

    const response = NextResponse.json({ ok: true });

    response.cookies.set("aleph_access_token", "", {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    response.cookies.set("aleph_refresh_token", "", {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "strict",
      path: "/api/auth",
      maxAge: 0,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
