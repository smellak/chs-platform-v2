import { desc, eq, count, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { AiConversationsClient } from "./ai-conversations-client";

export default async function AiConversationsPage() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) redirect("/");

  const db = getDb();

  const conversations = await db
    .select({
      id: schema.agentConversations.id,
      title: schema.agentConversations.title,
      userName: sql<string>`concat(${schema.users.firstName}, ' ', ${schema.users.lastName})`,
      userEmail: schema.users.email,
      messageCount: count(schema.agentMessages.id),
      totalTokens: sql<number>`coalesce(sum(${schema.agentMessages.tokensUsed}), 0)`,
      lastModel: sql<string>`max(${schema.agentMessages.model})`,
      createdAt: schema.agentConversations.createdAt,
      updatedAt: schema.agentConversations.updatedAt,
    })
    .from(schema.agentConversations)
    .leftJoin(schema.users, eq(schema.agentConversations.userId, schema.users.id))
    .leftJoin(
      schema.agentMessages,
      eq(schema.agentConversations.id, schema.agentMessages.conversationId),
    )
    .groupBy(
      schema.agentConversations.id,
      schema.agentConversations.title,
      schema.agentConversations.createdAt,
      schema.agentConversations.updatedAt,
      schema.users.firstName,
      schema.users.lastName,
      schema.users.email,
    )
    .orderBy(desc(schema.agentConversations.updatedAt))
    .limit(100);

  return (
    <AiConversationsClient
      conversations={conversations.map((c) => ({
        id: c.id,
        title: c.title ?? "Sin título",
        userName: c.userName,
        userEmail: c.userEmail ?? "",
        messageCount: c.messageCount,
        totalTokens: Number(c.totalTokens),
        lastModel: c.lastModel ?? "—",
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }))}
    />
  );
}
