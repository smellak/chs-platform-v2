import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { extractTokenFromHeaders, verifyAccessToken } from "@aleph/auth";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = extractTokenFromHeaders(request.headers);
  if (!token) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const db = getDb();

  const usersFound = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, payload.userId))
    .limit(1);

  const user = usersFound[0];
  if (!user?.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body: unknown = await request.json();
  const parsed = createKeySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const rawKey = `chs_sk_${randomBytes(20).toString("hex")}`;
  const keyPrefix = rawKey.slice(0, 12);
  const keyHash = bcrypt.hashSync(rawKey, 10);

  await db.insert(schema.apiKeys).values({
    orgId: user.orgId,
    name: parsed.data.name,
    keyHash,
    keyPrefix,
    createdBy: user.id,
  });

  await db.insert(schema.activityLogs).values({
    orgId: user.orgId,
    userId: user.id,
    action: "api-key.create",
    details: { name: parsed.data.name, prefix: keyPrefix },
  });

  return NextResponse.json({ success: true, key: rawKey });
}
