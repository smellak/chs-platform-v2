import { count, sum, eq, desc, sql, gte, and } from "drizzle-orm";
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

  // Per-model stats
  const modelStats = await db
    .select({
      model: schema.agentMessages.model,
      messageCount: count(),
      totalTokens: sum(schema.agentMessages.tokensUsed),
      avgLatency: sql<number>`round(avg(${schema.agentMessages.latencyMs}))`,
    })
    .from(schema.agentMessages)
    .where(
      and(
        eq(schema.agentMessages.role, "assistant"),
        sql`${schema.agentMessages.model} IS NOT NULL`,
      ),
    )
    .groupBy(schema.agentMessages.model)
    .orderBy(desc(count()));

  // Per-user stats
  const userStats = await db
    .select({
      userName: sql<string>`concat(${schema.users.firstName}, ' ', ${schema.users.lastName})`,
      messageCount: count(schema.agentMessages.id),
      totalTokens: sum(schema.agentMessages.tokensUsed),
      conversationCount: sql<number>`count(distinct ${schema.agentConversations.id})`,
    })
    .from(schema.agentConversations)
    .innerJoin(schema.users, eq(schema.agentConversations.userId, schema.users.id))
    .leftJoin(
      schema.agentMessages,
      eq(schema.agentConversations.id, schema.agentMessages.conversationId),
    )
    .groupBy(schema.users.id, schema.users.firstName, schema.users.lastName)
    .orderBy(desc(sum(schema.agentMessages.tokensUsed)))
    .limit(20);

  // Active alerts
  const alerts = await db
    .select({
      id: schema.aiAlerts.id,
      severity: schema.aiAlerts.severity,
      title: schema.aiAlerts.title,
      message: schema.aiAlerts.message,
      isResolved: schema.aiAlerts.isResolved,
      createdAt: schema.aiAlerts.createdAt,
    })
    .from(schema.aiAlerts)
    .orderBy(desc(schema.aiAlerts.createdAt))
    .limit(50);

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
      modelStats={modelStats.map((row) => ({
        model: row.model ?? "unknown",
        messageCount: row.messageCount,
        totalTokens: Number(row.totalTokens ?? 0),
        avgLatency: row.avgLatency ?? 0,
      }))}
      userStats={userStats.map((row) => ({
        userName: row.userName,
        messageCount: row.messageCount,
        totalTokens: Number(row.totalTokens ?? 0),
        conversationCount: Number(row.conversationCount),
      }))}
      alerts={alerts.map((a) => ({
        id: a.id,
        severity: a.severity,
        title: a.title,
        message: a.message,
        isResolved: a.isResolved,
        createdAt: a.createdAt.toISOString(),
      }))}
    />
  );
}
