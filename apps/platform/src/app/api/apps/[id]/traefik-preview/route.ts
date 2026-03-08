import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { extractTokenFromHeaders, verifyAccessToken } from "@aleph/auth";
import { getDb, schema } from "@/lib/db";
import { TraefikManager } from "@/lib/traefik-manager";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const token = extractTokenFromHeaders(request.headers);
  if (!token || !verifyAccessToken(token)) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const results = await db
    .select({
      appSlug: schema.apps.slug,
      appName: schema.apps.name,
      internalUrl: schema.appInstances.internalUrl,
      externalDomain: schema.appInstances.externalDomain,
      publicPaths: schema.appInstances.publicPaths,
    })
    .from(schema.appInstances)
    .innerJoin(schema.apps, eq(schema.appInstances.appId, schema.apps.id))
    .where(eq(schema.apps.id, id))
    .limit(1);

  const data = results[0];
  if (!data) {
    return NextResponse.json({ error: "App no encontrada" }, { status: 404 });
  }
  if (!data.externalDomain) {
    return NextResponse.json({ error: "Dominio externo no configurado" }, { status: 400 });
  }

  const manager = new TraefikManager();
  const chsVerifyUrl = TraefikManager.resolveCHSVerifyUrl();

  const yaml = manager.generateYaml({
    appSlug: data.appSlug,
    appName: data.appName,
    externalDomain: data.externalDomain,
    internalUrl: data.internalUrl,
    publicPaths: (data.publicPaths ?? []) as string[],
    chsVerifyUrl,
  });

  return NextResponse.json({ yaml });
}
