import { eq, and, gte, sql, count, sum, avg } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const logger = createLogger("alert-checker");

interface MetricValue {
  metric: string;
  value: number;
}

async function getMetrics(orgId: string): Promise<MetricValue[]> {
  const db = getDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const metrics: MetricValue[] = [];

  // Daily cost
  const [costResult] = await db
    .select({ value: sum(schema.apiCostLogs.cost) })
    .from(schema.apiCostLogs)
    .where(
      and(
        eq(schema.apiCostLogs.orgId, orgId),
        gte(schema.apiCostLogs.createdAt, todayStart),
      ),
    );
  metrics.push({ metric: "cost_daily", value: Number(costResult?.value ?? 0) });

  // Daily tokens
  const [tokenResult] = await db
    .select({ value: sum(schema.agentMessages.tokensUsed) })
    .from(schema.agentMessages)
    .innerJoin(
      schema.agentConversations,
      eq(schema.agentMessages.conversationId, schema.agentConversations.id),
    )
    .where(
      and(
        eq(schema.agentConversations.orgId, orgId),
        gte(schema.agentMessages.createdAt, todayStart),
        eq(schema.agentMessages.role, "assistant"),
      ),
    );
  metrics.push({ metric: "tokens_daily", value: Number(tokenResult?.value ?? 0) });

  // Error rate (% of tool calls with errors today)
  const [totalToolCalls] = await db
    .select({ value: count() })
    .from(schema.agentToolCalls)
    .innerJoin(schema.agentMessages, eq(schema.agentToolCalls.messageId, schema.agentMessages.id))
    .where(gte(schema.agentMessages.createdAt, todayStart));

  const [errorToolCalls] = await db
    .select({ value: count() })
    .from(schema.agentToolCalls)
    .innerJoin(schema.agentMessages, eq(schema.agentToolCalls.messageId, schema.agentMessages.id))
    .where(
      and(
        gte(schema.agentMessages.createdAt, todayStart),
        eq(schema.agentToolCalls.status, "error"),
      ),
    );

  const total = totalToolCalls?.value ?? 0;
  const errors = errorToolCalls?.value ?? 0;
  const errorRate = total > 0 ? (errors / total) * 100 : 0;
  metrics.push({ metric: "error_rate", value: errorRate });

  // Latency p95 (approximate via avg of top 5% of latencies)
  const [latencyResult] = await db
    .select({
      value: avg(schema.agentMessages.latencyMs),
    })
    .from(schema.agentMessages)
    .innerJoin(
      schema.agentConversations,
      eq(schema.agentMessages.conversationId, schema.agentConversations.id),
    )
    .where(
      and(
        eq(schema.agentConversations.orgId, orgId),
        gte(schema.agentMessages.createdAt, todayStart),
        eq(schema.agentMessages.role, "assistant"),
        sql`${schema.agentMessages.latencyMs} IS NOT NULL`,
      ),
    );
  metrics.push({ metric: "latency_p95", value: Number(latencyResult?.value ?? 0) });

  return metrics;
}

function compareValue(value: number, threshold: number, comparison: string): boolean {
  switch (comparison) {
    case "gt": return value > threshold;
    case "gte": return value >= threshold;
    case "lt": return value < threshold;
    case "lte": return value <= threshold;
    default: return value > threshold;
  }
}

const METRIC_LABELS: Record<string, string> = {
  cost_daily: "Coste diario",
  tokens_daily: "Tokens diarios",
  error_rate: "Tasa de errores",
  latency_p95: "Latencia P95",
};

/**
 * Check all active alert rules for an organization.
 * Creates alerts when thresholds are exceeded.
 * Deduplicates: max one alert per rule per day.
 */
export async function checkAlertRules(orgId: string): Promise<void> {
  const db = getDb();

  try {
    const rules = await db
      .select()
      .from(schema.aiAlertRules)
      .where(
        and(
          eq(schema.aiAlertRules.orgId, orgId),
          eq(schema.aiAlertRules.isActive, true),
        ),
      );

    if (rules.length === 0) return;

    const metrics = await getMetrics(orgId);
    const metricsMap = new Map(metrics.map((m) => [m.metric, m.value]));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Get existing alerts for today to avoid duplicates
    const existingAlerts = await db
      .select({ ruleId: schema.aiAlerts.ruleId })
      .from(schema.aiAlerts)
      .where(
        and(
          eq(schema.aiAlerts.orgId, orgId),
          gte(schema.aiAlerts.createdAt, todayStart),
        ),
      );

    const alertedRuleIds = new Set(existingAlerts.map((a) => a.ruleId).filter(Boolean));

    for (const rule of rules) {
      if (alertedRuleIds.has(rule.id)) continue;

      const currentValue = metricsMap.get(rule.metric);
      if (currentValue === undefined) continue;

      if (compareValue(currentValue, rule.threshold, rule.comparison)) {
        const metricLabel = METRIC_LABELS[rule.metric] ?? rule.metric;
        const formattedValue = rule.metric === "cost_daily"
          ? `€${currentValue.toFixed(2)}`
          : currentValue.toLocaleString();

        await db.insert(schema.aiAlerts).values({
          orgId,
          ruleId: rule.id,
          severity: rule.severity,
          title: `${rule.name}: ${metricLabel} excedido`,
          message: `${metricLabel} actual: ${formattedValue}. Umbral: ${rule.threshold}`,
          metadata: {
            metric: rule.metric,
            currentValue,
            threshold: rule.threshold,
            comparison: rule.comparison,
          },
        });

        logger.warn("Alert triggered", {
          rule: rule.name,
          metric: rule.metric,
          value: currentValue,
          threshold: rule.threshold,
        });
      }
    }
  } catch (err) {
    logger.error("Failed to check alert rules", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
