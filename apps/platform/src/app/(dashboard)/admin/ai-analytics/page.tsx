import { count, sum, eq, desc, sql, gte } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { AIAnalyticsClient } from "./ai-analytics-client";

export default async function AIAnalyticsPage() {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) redirect("/");

  const db = getDb();

  const [conversationCount] = await db
    .select({ value: count() })
    .from(schema.agentConversations);

  const [messageCount] = await db
    .select({ value: count() })
    .from(schema.agentMessages);

  const [tokenSum] = await db
    .select({ value: sum(schema.agentMessages.tokensUsed) })
    .from(schema.agentMessages);

  const [costSum] = await db
    .select({ value: sum(schema.apiCostLogs.cost) })
    .from(schema.apiCostLogs)
    .where(eq(schema.apiCostLogs.endpoint, "agent.chat"));

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const messagesPerDay = await db
    .select({
      date: sql<string>`to_char(${schema.agentMessages.createdAt}, 'YYYY-MM-DD')`,
      count: count(),
    })
    .from(schema.agentMessages)
    .where(gte(schema.agentMessages.createdAt, sevenDaysAgo))
    .groupBy(sql`to_char(${schema.agentMessages.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${schema.agentMessages.createdAt}, 'YYYY-MM-DD')`);

  const topTools = await db
    .select({
      capability: schema.agentToolCalls.capability,
      count: count(),
    })
    .from(schema.agentToolCalls)
    .groupBy(schema.agentToolCalls.capability)
    .orderBy(desc(count()))
    .limit(10);

  const recentConversations = await db
    .select({
      id: schema.agentConversations.id,
      title: schema.agentConversations.title,
      userName: sql<string>`concat(${schema.users.firstName}, ' ', ${schema.users.lastName})`,
      messageCount: count(schema.agentMessages.id),
      createdAt: schema.agentConversations.createdAt,
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
      schema.users.firstName,
      schema.users.lastName,
    )
    .orderBy(desc(schema.agentConversations.createdAt))
    .limit(10);

  return (
    <AIAnalyticsClient
      stats={{
        totalConversations: conversationCount?.value ?? 0,
        totalMessages: messageCount?.value ?? 0,
        totalTokens: Number(tokenSum?.value ?? 0),
        totalCost: Number(costSum?.value ?? 0),
      }}
      messagesPerDay={messagesPerDay.map((row) => ({
        date: row.date,
        count: row.count,
      }))}
      topTools={topTools.map((row) => ({
        capability: row.capability,
        count: row.count,
      }))}
      recentConversations={recentConversations.map((row) => ({
        id: row.id,
        title: row.title ?? "Sin título",
        userName: row.userName,
        messageCount: row.messageCount,
        createdAt: row.createdAt.toISOString(),
      }))}
    />
  );
}
