import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import { extractTokenFromHeaders, verifyAccessToken } from "@aleph/auth";
import { getDb, schema } from "@/lib/db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = extractTokenFromHeaders(request.headers);
  if (!token || !verifyAccessToken(token)) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const db = getDb();
  const apps = await db.select().from(schema.apps);
  const instances = await db.select().from(schema.appInstances);

  const services = [];
  for (const app of apps) {
    const instance = instances.find((i) => i.appId === app.id);

    // Get latest service status if available
    let latestStatus: { responseMs: number | null; httpCode: number | null; checkedAt: Date } | undefined;
    if (instance) {
      const statuses = await db
        .select({
          responseMs: schema.serviceStatus.responseMs,
          httpCode: schema.serviceStatus.httpCode,
          checkedAt: schema.serviceStatus.checkedAt,
        })
        .from(schema.serviceStatus)
        .where(eq(schema.serviceStatus.appInstanceId, instance.id))
        .orderBy(desc(schema.serviceStatus.checkedAt))
        .limit(1);
      latestStatus = statuses[0];
    }

    services.push({
      id: app.id,
      name: app.name,
      slug: app.slug,
      icon: app.icon,
      color: app.color,
      isActive: app.isActive,
      isMaintenance: app.isMaintenance,
      status: instance?.status ?? "unknown",
      lastHealthCheck: instance?.lastHealthCheck ?? null,
      responseMs: latestStatus?.responseMs ?? null,
      httpCode: latestStatus?.httpCode ?? null,
      externalDomain: instance?.externalDomain ?? null,
      internalUrl: instance?.internalUrl ?? null,
    });
  }

  return NextResponse.json(services);
}
