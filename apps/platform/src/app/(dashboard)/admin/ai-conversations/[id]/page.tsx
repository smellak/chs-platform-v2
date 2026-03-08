import { eq, asc, sql } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { ConversationDetailClient } from "./conversation-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ConversationDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) redirect("/");

  const { id } = await params;
  const db = getDb();

  const conversations = await db
    .select({
      id: schema.agentConversations.id,
      title: schema.agentConversations.title,
      userName: sql<string>`concat(${schema.users.firstName}, ' ', ${schema.users.lastName})`,
      userEmail: schema.users.email,
      createdAt: schema.agentConversations.createdAt,
    })
    .from(schema.agentConversations)
    .leftJoin(schema.users, eq(schema.agentConversations.userId, schema.users.id))
    .where(eq(schema.agentConversations.id, id))
    .limit(1);

  const conversation = conversations[0];
  if (!conversation) notFound();

  const messages = await db
    .select({
      id: schema.agentMessages.id,
      role: schema.agentMessages.role,
      content: schema.agentMessages.content,
      toolCalls: schema.agentMessages.toolCalls,
      tokensUsed: schema.agentMessages.tokensUsed,
      inputTokens: schema.agentMessages.inputTokens,
      outputTokens: schema.agentMessages.outputTokens,
      model: schema.agentMessages.model,
      latencyMs: schema.agentMessages.latencyMs,
      createdAt: schema.agentMessages.createdAt,
    })
    .from(schema.agentMessages)
    .where(eq(schema.agentMessages.conversationId, id))
    .orderBy(asc(schema.agentMessages.createdAt));

  const toolCalls = await db
    .select({
      id: schema.agentToolCalls.id,
      messageId: schema.agentToolCalls.messageId,
      capability: schema.agentToolCalls.capability,
      parameters: schema.agentToolCalls.parameters,
      response: schema.agentToolCalls.response,
      status: schema.agentToolCalls.status,
      errorMessage: schema.agentToolCalls.errorMessage,
      durationMs: schema.agentToolCalls.durationMs,
      executedAt: schema.agentToolCalls.executedAt,
      appName: schema.apps.name,
    })
    .from(schema.agentToolCalls)
    .leftJoin(schema.apps, eq(schema.agentToolCalls.appId, schema.apps.id))
    .innerJoin(schema.agentMessages, eq(schema.agentToolCalls.messageId, schema.agentMessages.id))
    .where(eq(schema.agentMessages.conversationId, id))
    .orderBy(asc(schema.agentToolCalls.executedAt));

  // Group tool calls by messageId
  const toolCallsByMessage = new Map<string, typeof toolCalls>();
  for (const tc of toolCalls) {
    const existing = toolCallsByMessage.get(tc.messageId) ?? [];
    existing.push(tc);
    toolCallsByMessage.set(tc.messageId, existing);
  }

  return (
    <ConversationDetailClient
      conversation={{
        id: conversation.id,
        title: conversation.title ?? "Sin título",
        userName: conversation.userName,
        userEmail: conversation.userEmail ?? "",
        createdAt: conversation.createdAt.toISOString(),
      }}
      messages={messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCalls: (m.toolCalls ?? []) as Array<{ toolName: string; args: Record<string, unknown> }>,
        tokensUsed: m.tokensUsed,
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        model: m.model,
        latencyMs: m.latencyMs,
        createdAt: m.createdAt.toISOString(),
        toolCallRecords: (toolCallsByMessage.get(m.id) ?? []).map((tc) => ({
          id: tc.id,
          capability: tc.capability,
          parameters: tc.parameters as Record<string, unknown>,
          response: tc.response as Record<string, unknown> | null,
          status: tc.status,
          errorMessage: tc.errorMessage,
          durationMs: tc.durationMs,
          appName: tc.appName,
        })),
      }))}
    />
  );
}
