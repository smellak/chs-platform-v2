import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { streamText, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { buildAgentContext } from "@/lib/agent/context";
import { buildSystemPrompt } from "@/lib/agent/system-prompt";
import { getPlatformTools } from "@/lib/agent/platform-tools";
import { getAppTools } from "@/lib/agent/app-tools";
import { convertToAISDKTools } from "@/lib/agent/convert-tools";
import { checkRateLimit } from "@/lib/agent/rate-limit";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  messages: ChatMessage[];
  conversationId?: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  const userId = request.headers.get("x-aleph-user-id");
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Check API key
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    return NextResponse.json(
      { error: "Servicio de IA no disponible. Contacte al administrador." },
      { status: 503 },
    );
  }

  // Parse body
  const body = (await request.json()) as ChatRequestBody;
  const { messages, conversationId: reqConvId } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Mensajes requeridos" }, { status: 400 });
  }

  // Rate limit
  const rateCheck = await checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
  }

  // Build context
  const ctx = await buildAgentContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const db = getDb();

  // Create or retrieve conversation
  let convId = reqConvId;
  if (!convId) {
    const firstMsg = messages[messages.length - 1]?.content ?? "";
    const title = firstMsg.slice(0, 60) || "Nueva conversación";
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
    await db.insert(schema.agentMessages).values({
      conversationId: convId,
      role: "user",
      content: lastUserMsg.content,
    });
  }

  // Build system prompt and tools
  const systemPrompt = buildSystemPrompt(ctx);
  const platformTools = getPlatformTools(ctx);
  const appTools = getAppTools(ctx);
  const allTools = [...platformTools, ...appTools];
  const aiTools = convertToAISDKTools(allTools);

  const model = process.env["AI_MODEL"] ?? "claude-sonnet-4-20250514";
  const maxTokens = Number(process.env["AI_MAX_TOKENS"] ?? "4096");

  const startTime = Date.now();
  const finalConvId = convId;

  // Stream with Anthropic via AI SDK
  const result = streamText({
    model: anthropic(model),
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    tools: aiTools,
    stopWhen: stepCountIs(10),
    maxOutputTokens: maxTokens,
    onFinish: async ({ text, toolCalls, usage }) => {
      const latencyMs = Date.now() - startTime;
      const totalTokens = usage?.totalTokens ?? 0;

      // Save assistant message
      const toolCallData = toolCalls?.map((tc) => ({
        toolName: tc.toolName,
        args: tc.input,
      }));

      const msgInserted = await db.insert(schema.agentMessages).values({
        conversationId: finalConvId,
        role: "assistant",
        content: text || "",
        toolCalls: toolCallData as Record<string, unknown>[] | undefined,
        tokensUsed: totalTokens,
        model,
        latencyMs,
      }).returning({ id: schema.agentMessages.id });

      const msgId = msgInserted[0]?.id;

      // Save individual tool calls
      if (msgId && toolCalls) {
        for (const tc of toolCalls) {
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
          toolsUsed: toolCalls?.map((t) => t.toolName),
          tokensUsed: totalTokens,
        },
      });

      // API cost log
      if (totalTokens > 0) {
        // Find or create Anthropic provider
        const providers = await db.select().from(schema.apiProviders)
          .where(eq(schema.apiProviders.slug, "anthropic"))
          .limit(1);

        let providerId = providers[0]?.id;
        if (!providerId) {
          const newProvider = await db.insert(schema.apiProviders).values({
            orgId: ctx.organization.id,
            name: "Anthropic",
            slug: "anthropic",
            model,
            costPer1kInput: 0.003,
            costPer1kOutput: 0.015,
          }).returning({ id: schema.apiProviders.id });
          providerId = newProvider[0]?.id;
        }

        if (providerId) {
          const inputTokens = usage?.inputTokens ?? 0;
          const outputTokens = usage?.outputTokens ?? 0;
          const cost = (inputTokens / 1000) * 0.003 + (outputTokens / 1000) * 0.015;

          await db.insert(schema.apiCostLogs).values({
            providerId,
            orgId: ctx.organization.id,
            tokens: totalTokens,
            cost,
            endpoint: "agent.chat",
            userId,
          });
        }
      }
    },
  });

  return result.toUIMessageStreamResponse({
    headers: {
      "X-Conversation-Id": finalConvId,
    },
  });
}
