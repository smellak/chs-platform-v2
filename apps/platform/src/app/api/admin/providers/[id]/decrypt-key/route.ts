import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { decryptApiKey } from "@chs-platform/auth/crypto";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const db = getDb();
  const providers = await db
    .select({ apiKeyEncrypted: schema.apiProviders.apiKeyEncrypted })
    .from(schema.apiProviders)
    .where(eq(schema.apiProviders.id, id))
    .limit(1);

  const provider = providers[0];
  if (!provider?.apiKeyEncrypted) {
    return NextResponse.json({ error: "No hay API key configurada" }, { status: 404 });
  }

  try {
    const decrypted = decryptApiKey(provider.apiKeyEncrypted);
    return NextResponse.json({ apiKey: decrypted });
  } catch {
    return NextResponse.json({ error: "Error al descifrar la API key" }, { status: 500 });
  }
}
