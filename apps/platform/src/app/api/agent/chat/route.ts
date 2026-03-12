import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { streamText, stepCountIs } from "ai";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { buildAgentContext } from "@/lib/agent/context";
import { buildSystemPrompt } from "@/lib/agent/system-prompt";
import { getPlatformTools } from "@/lib/agent/platform-tools";
import { getAppTools } from "@/lib/agent/app-tools";
import { convertToAISDKTools } from "@/lib/agent/convert-tools";
import { checkRateLimit } from "@/lib/agent/rate-limit";
import { resolveModel } from "@/lib/agent/model-resolver";
import { checkAlertRules } from "@/lib/agent/alert-checker";
import { createLogger } from "@/lib/logger";

const logger = createLogger("agent-chat");

interface UIMessagePart {
  type: string;
  text?: string;
  toolName?: string;
  [key: string]: unknown;
}

interface ChatMessage {
  role: "user" | "assistant";
  content?: string;
  parts?: UIMessagePart[];
}

interface ChatRequestBody {
  messages: ChatMessage[];
  conversationId?: string;
}

/** Extract text from a message that may use `content` (string) or `parts` (AI SDK v6 UIMessage). */
function extractTextContent(msg: ChatMessage): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text!)
      .join("");
  }
  return "";
}

export async function POST(request: NextRequest): Promise<Response> {
  const userId = request.headers.get("x-chs-user-id");
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Parse body
  const body = (await request.json()) as ChatRequestBody;
  const { messages, conversationId: reqConvId } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Mensajes requeridos" }, { status: 400 });
  }

  // Build context (includes permission resolution)
  const ctx = await buildAgentContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Rate limit (with permission-based overrides)
  const rateCheck = await checkRateLimit(userId, {
    maxMessagesPerHour: ctx.agentPermissions?.maxMessagesPerHour,
    maxTokensPerDay: ctx.agentPermissions?.maxTokensPerDay,
  });
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
  }

  // Resolve AI model (multi-provider)
  let resolved;
  try {
    resolved = await resolveModel(ctx.organization.id);
  } catch (err) {
    logger.error("Failed to resolve AI model", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Servicio de IA no disponible. Contacte al administrador." },
      { status: 503 },
    );
  }

  const db = getDb();

  // Create or retrieve conversation
  let convId = reqConvId;
  if (!convId) {
    const lastMsg = messages[messages.length - 1];
    const firstMsgText = lastMsg ? extractTextContent(lastMsg) : "";
    const title = firstMsgText.slice(0, 60) || "Nueva conversación";
    const inserted = await db.insert(schema.agentConversations).values({
      userId,
      orgId: ctx.organization.id,
      title,
    }).returning({ id: schema.agentConversations.id });
    convId = inserted[0]?.id;
  }

  if (!convId) {
    return NextResponse.json({ error: "Error creando conversación" }, { status: 500 });
  }

  // Save user message
  const lastUserMsg = messages[messages.length - 1];
  if (lastUserMsg?.role === "user") {
    const userContent = extractTextContent(lastUserMsg);
    await db.insert(schema.agentMessages).values({
      conversationId: convId,
      role: "user",
      content: userContent,
    });
  }

  // Build system prompt and tools
  const systemPrompt = buildSystemPrompt(ctx);
  const platformTools = getPlatformTools(ctx);
  const appTools = getAppTools(ctx);
  const allTools = [...platformTools, ...appTools];
  const aiTools = convertToAISDKTools(allTools);

  const startTime = Date.now();
  const finalConvId = convId;

  // Stream with resolved provider via AI SDK
  const result = streamText({
    model: resolved.model,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: extractTextContent(m),
    })),
    tools: aiTools,
    stopWhen: stepCountIs(10),
    maxOutputTokens: resolved.maxTokens,
    onFinish: async ({ text, toolCalls, steps, totalUsage }) => {
      const latencyMs = Date.now() - startTime;
      const totalTokens = totalUsage?.totalTokens ?? 0;
      const inputTokens = totalUsage?.inputTokens ?? 0;
      const outputTokens = totalUsage?.outputTokens ?? 0;

      // Collect tool calls from ALL steps (not just the last one)
      const allToolCalls = steps?.flatMap((s) => s.toolCalls ?? []) ?? toolCalls ?? [];

      // Save assistant message with enhanced tracing
      const toolCallData = allToolCalls.length > 0
        ? allToolCalls.map((tc) => ({
            toolName: tc.toolName,
            args: tc.input,
          }))
        : undefined;

      const msgInserted = await db.insert(schema.agentMessages).values({
        conversationId: finalConvId,
        role: "assistant",
        content: text || "",
        toolCalls: toolCallData as Record<string, unknown>[] | undefined,
        tokensUsed: totalTokens,
        inputTokens,
        outputTokens,
        model: resolved.modelId,
        providerId: resolved.providerId || null,
        modelId: resolved.aiModelId || null,
        latencyMs,
      }).returning({ id: schema.agentMessages.id });

      const msgId = msgInserted[0]?.id;

      // Save individual tool calls from all steps
      if (msgId && allToolCalls.length > 0) {
        for (const tc of allToolCalls) {
          const [appSlug] = tc.toolName.split("__");
          const app = ctx.availableApps.find((a) => a.slug === appSlug);
          await db.insert(schema.agentToolCalls).values({
            messageId: msgId,
            appId: app?.id ?? null,
            capability: tc.toolName,
            parameters: tc.input as Record<string, unknown>,
            status: "completed",
            executedAt: new Date(),
            durationMs: latencyMs,
          });
        }
      }

      // Update conversation timestamp
      await db.update(schema.agentConversations)
        .set({ updatedAt: new Date() })
        .where(eq(schema.agentConversations.id, finalConvId));

      // Activity log
      await db.insert(schema.activityLogs).values({
        orgId: ctx.organization.id,
        userId,
        action: "agent.chat",
        details: {
          conversationId: finalConvId,
          toolsUsed: allToolCalls.map((t) => t.toolName),
          tokensUsed: totalTokens,
          model: resolved.modelId,
          provider: resolved.providerName,
        },
      });

      // API cost log
      if (totalTokens > 0 && resolved.providerId) {
        const cost =
          (inputTokens / 1000) * resolved.costPer1kInput +
          (outputTokens / 1000) * resolved.costPer1kOutput;

        await db.insert(schema.apiCostLogs).values({
          providerId: resolved.providerId,
          orgId: ctx.organization.id,
          tokens: totalTokens,
          cost,
          endpoint: "agent.chat",
          userId,
        });
      }

      logger.info("Chat completed", {
        conversationId: finalConvId,
        model: resolved.modelId,
        provider: resolved.providerName,
        tokens: totalTokens,
        latencyMs,
      });

      // Check alert rules (async, non-blocking)
      checkAlertRules(ctx.organization.id).catch((err) => {
        logger.error("Alert check failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    },
  });

  return result.toUIMessageStreamResponse({
    headers: {
      "X-Conversation-Id": finalConvId,
    },
  });
}
