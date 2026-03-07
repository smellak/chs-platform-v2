import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { extractTokenFromHeaders, verifyAccessToken } from "@aleph/auth";
import { getDb, schema } from "@/lib/db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = extractTokenFromHeaders(request.headers);
  if (!token || !verifyAccessToken(token)) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const db = getDb();
  const apps = await db.select().from(schema.apps);
  return NextResponse.json(apps);
}
