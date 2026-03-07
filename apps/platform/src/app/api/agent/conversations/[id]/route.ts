import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const userId = request.headers.get("x-aleph-user-id");
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const db = getDb();

    const [conversation] = await db
      .select()
      .from(schema.agentConversations)
      .where(
        and(
          eq(schema.agentConversations.id, id),
          eq(schema.agentConversations.userId, userId),
        ),
      );

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversación no encontrada" },
        { status: 404 },
      );
    }

    const messages = await db
      .select()
      .from(schema.agentMessages)
      .where(eq(schema.agentMessages.conversationId, id))
      .orderBy(desc(schema.agentMessages.createdAt));

    return NextResponse.json({ conversation, messages });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error al obtener conversación";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const userId = request.headers.get("x-aleph-user-id");
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body: { title: string } = await request.json();
    const db = getDb();

    const [updated] = await db
      .update(schema.agentConversations)
      .set({
        title: body.title,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.agentConversations.id, id),
          eq(schema.agentConversations.userId, userId),
        ),
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Conversación no encontrada" },
        { status: 404 },
      );
    }

    return NextResponse.json({ conversation: updated });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Error al actualizar conversación";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const userId = request.headers.get("x-aleph-user-id");
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const db = getDb();

    // Verify ownership before deletion
    const [conversation] = await db
      .select({ id: schema.agentConversations.id })
      .from(schema.agentConversations)
      .where(
        and(
          eq(schema.agentConversations.id, id),
          eq(schema.agentConversations.userId, userId),
        ),
      );

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversación no encontrada" },
        { status: 404 },
      );
    }

    // Get message IDs for cascading tool call deletion
    const messages = await db
      .select({ id: schema.agentMessages.id })
      .from(schema.agentMessages)
      .where(eq(schema.agentMessages.conversationId, id));

    const messageIds = messages.map((m) => m.id);

    // Delete tool calls for all messages in this conversation
    if (messageIds.length > 0) {
      for (const messageId of messageIds) {
        await db
          .delete(schema.agentToolCalls)
          .where(eq(schema.agentToolCalls.messageId, messageId));
      }
    }

    // Delete messages
    await db
      .delete(schema.agentMessages)
      .where(eq(schema.agentMessages.conversationId, id));

    // Delete conversation
    await db
      .delete(schema.agentConversations)
      .where(eq(schema.agentConversations.id, id));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Error al eliminar conversación";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
