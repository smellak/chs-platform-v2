import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { extractTokenFromHeaders, verifyAccessToken } from "@chs-platform/auth";
import { getDb, schema } from "@/lib/db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = extractTokenFromHeaders(request.headers);
  if (!token || !verifyAccessToken(token)) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const db = getDb();
  const apps = await db.select().from(schema.apps);
  const instances = await db.select().from(schema.appInstances);

  const totalApps = apps.length;
  const maintenanceApps = apps.filter((a) => a.isMaintenance).length;

  const statusMap = new Map(instances.map((i) => [i.appId, i.status]));
  const onlineApps = apps.filter((a) => statusMap.get(a.id) === "online").length;
  const offlineApps = apps.filter((a) => statusMap.get(a.id) === "offline" && !a.isMaintenance).length;

  return NextResponse.json({
    totalApps,
    onlineApps,
    offlineApps,
    maintenanceApps,
  });
}
