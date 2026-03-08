import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = request.headers.get("x-chs-user-id");
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const db = getDb();

    const conversations = await db
      .select()
      .from(schema.agentConversations)
      .where(eq(schema.agentConversations.userId, userId))
      .orderBy(desc(schema.agentConversations.updatedAt))
      .limit(20);

    return NextResponse.json({ conversations });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error al listar conversaciones";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = request.headers.get("x-chs-user-id");
  const orgId = request.headers.get("x-chs-org-id");
  if (!userId || !orgId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { title?: string };
    const db = getDb();

    const [conversation] = await db
      .insert(schema.agentConversations)
      .values({
        userId,
        orgId,
        title: body.title ?? "Nueva conversación",
      })
      .returning();

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error al crear conversación";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
