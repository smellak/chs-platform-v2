import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import { extractTokenFromHeaders, verifyAccessToken } from "@chs-platform/auth";
import { getDb, schema } from "@/lib/db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = extractTokenFromHeaders(request.headers);
  if (!token || !verifyAccessToken(token)) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const db = getDb();
  const logs = await db
    .select({
      id: schema.activityLogs.id,
      action: schema.activityLogs.action,
      entityType: schema.activityLogs.entityType,
      entityId: schema.activityLogs.entityId,
      details: schema.activityLogs.details,
      createdAt: schema.activityLogs.createdAt,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
    })
    .from(schema.activityLogs)
    .leftJoin(schema.users, eq(schema.activityLogs.userId, schema.users.id))
    .orderBy(desc(schema.activityLogs.createdAt))
    .limit(20);

  return NextResponse.json(logs);
}
