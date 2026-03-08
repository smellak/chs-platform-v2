import { eq, and, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

const DEFAULT_MSG_LIMIT = Number(process.env["AI_RATE_LIMIT_MESSAGES_PER_HOUR"] ?? "50");
const DEFAULT_TOKEN_LIMIT = Number(process.env["AI_RATE_LIMIT_TOKENS_PER_DAY"] ?? "100000");

interface RateLimitOverrides {
  maxMessagesPerHour?: number | null;
  maxTokensPerDay?: number | null;
}

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  messagesUsed?: number;
  tokensUsed?: number;
}

export async function checkRateLimit(
  userId: string,
  overrides?: RateLimitOverrides,
): Promise<RateLimitResult> {
  const db = getDb();

  const msgLimit = overrides?.maxMessagesPerHour ?? DEFAULT_MSG_LIMIT;
  const tokenLimit = overrides?.maxTokensPerDay ?? DEFAULT_TOKEN_LIMIT;

  // Check messages in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const msgCountResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.agentMessages)
    .innerJoin(
      schema.agentConversations,
      eq(schema.agentMessages.conversationId, schema.agentConversations.id),
    )
    .where(
      and(
        eq(schema.agentConversations.userId, userId),
        eq(schema.agentMessages.role, "user"),
        gte(schema.agentMessages.createdAt, oneHourAgo),
      ),
    );

  const messagesUsed = Number(msgCountResult[0]?.count ?? 0);

  if (messagesUsed >= msgLimit) {
    return {
      allowed: false,
      reason: `Has alcanzado el límite de ${msgLimit} mensajes por hora. Inténtalo más tarde.`,
      messagesUsed,
    };
  }

  // Check tokens today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const tokenResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.agentMessages.tokensUsed}), 0)` })
    .from(schema.agentMessages)
    .innerJoin(
      schema.agentConversations,
      eq(schema.agentMessages.conversationId, schema.agentConversations.id),
    )
    .where(
      and(
        eq(schema.agentConversations.userId, userId),
        gte(schema.agentMessages.createdAt, todayStart),
      ),
    );

  const tokensUsed = Number(tokenResult[0]?.total ?? 0);

  if (tokensUsed >= tokenLimit) {
    return {
      allowed: false,
      reason: `Has alcanzado el límite de ${tokenLimit.toLocaleString()} tokens por día. Inténtalo mañana.`,
      tokensUsed,
    };
  }

  return { allowed: true, messagesUsed, tokensUsed };
}
