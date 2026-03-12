import { eq, and, asc } from "drizzle-orm";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { getDb, schema } from "@/lib/db";
import { decryptApiKey } from "@chs-platform/auth/crypto";
import { createLogger } from "@/lib/logger";

const logger = createLogger("model-resolver");

type ProviderType = "anthropic" | "openai" | "google" | "xai";

export interface ResolvedModel {
  model: LanguageModelV3;
  modelId: string;
  displayName: string;
  providerId: string;
  providerType: ProviderType;
  providerName: string;
  aiModelId: string | null;
  costPer1kInput: number;
  costPer1kOutput: number;
  maxTokens: number;
}

function createProviderModel(
  providerType: ProviderType,
  modelId: string,
  apiKey?: string,
  baseUrl?: string,
): LanguageModelV3 {
  switch (providerType) {
    case "anthropic": {
      if (apiKey) {
        const custom = createAnthropic({ apiKey });
        return custom(modelId);
      }
      return anthropic(modelId);
    }
    case "openai": {
      if (apiKey || baseUrl) {
        const custom = createOpenAI({
          apiKey: apiKey ?? process.env["OPENAI_API_KEY"] ?? "",
          baseURL: baseUrl,
        });
        return custom(modelId);
      }
      return openai(modelId);
    }
    case "google": {
      if (apiKey) {
        const custom = createGoogleGenerativeAI({ apiKey });
        return custom(modelId);
      }
      return google(modelId);
    }
    case "xai": {
      // xAI uses OpenAI-compatible API
      const custom = createOpenAI({
        apiKey: apiKey ?? process.env["OPENAI_API_KEY"] ?? "",
        baseURL: baseUrl ?? "https://api.x.ai/v1",
      });
      return custom(modelId);
    }
    default:
      throw new Error(`Unknown provider type: ${providerType}`);
  }
}

/**
 * Resolves which AI model to use for a given organization and optional app context.
 * Resolution order:
 * 1. App-specific model assignment (sorted by priority)
 * 2. Org default model (isDefault=true)
 * 3. Fallback to environment variables (backward compatibility)
 */
export async function resolveModel(
  orgId: string,
  appId?: string,
): Promise<ResolvedModel> {
  const db = getDb();

  // 1. Check app-specific model assignments
  if (appId) {
    const assignments = await db
      .select({
        modelId: schema.aiModels.id,
        modelIdentifier: schema.aiModels.modelId,
        displayName: schema.aiModels.displayName,
        costPer1kInput: schema.aiModels.costPer1kInput,
        costPer1kOutput: schema.aiModels.costPer1kOutput,
        maxTokens: schema.aiModels.maxTokens,
        providerId: schema.apiProviders.id,
        providerName: schema.apiProviders.name,
        providerType: schema.apiProviders.providerType,
        apiKeyEncrypted: schema.apiProviders.apiKeyEncrypted,
        baseUrl: schema.apiProviders.baseUrl,
      })
      .from(schema.appModelAssignments)
      .innerJoin(schema.aiModels, eq(schema.appModelAssignments.modelId, schema.aiModels.id))
      .innerJoin(schema.apiProviders, eq(schema.aiModels.providerId, schema.apiProviders.id))
      .where(
        and(
          eq(schema.appModelAssignments.appId, appId),
          eq(schema.appModelAssignments.isActive, true),
          eq(schema.aiModels.isActive, true),
          eq(schema.apiProviders.isActive, true),
        ),
      )
      .orderBy(asc(schema.appModelAssignments.priority));

    for (const assignment of assignments) {
      try {
        const apiKey = assignment.apiKeyEncrypted
          ? decryptApiKey(assignment.apiKeyEncrypted)
          : undefined;

        const providerType = assignment.providerType as ProviderType;
        const model = createProviderModel(
          providerType,
          assignment.modelIdentifier,
          apiKey,
          assignment.baseUrl ?? undefined,
        );

        logger.info("Resolved app-specific model", {
          appId,
          modelId: assignment.modelIdentifier,
          provider: assignment.providerName,
        });

        return {
          model,
          modelId: assignment.modelIdentifier,
          displayName: assignment.displayName,
          providerId: assignment.providerId,
          providerType,
          providerName: assignment.providerName,
          aiModelId: assignment.modelId,
          costPer1kInput: assignment.costPer1kInput ?? 0,
          costPer1kOutput: assignment.costPer1kOutput ?? 0,
          maxTokens: assignment.maxTokens ?? 4096,
        };
      } catch (err) {
        logger.warn("Failed to create provider for assignment, trying next", {
          modelId: assignment.modelIdentifier,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
    }
  }

  // 2. Check org default model
  const defaultModels = await db
    .select({
      modelId: schema.aiModels.id,
      modelIdentifier: schema.aiModels.modelId,
      displayName: schema.aiModels.displayName,
      costPer1kInput: schema.aiModels.costPer1kInput,
      costPer1kOutput: schema.aiModels.costPer1kOutput,
      maxTokens: schema.aiModels.maxTokens,
      providerId: schema.apiProviders.id,
      providerName: schema.apiProviders.name,
      providerType: schema.apiProviders.providerType,
      apiKeyEncrypted: schema.apiProviders.apiKeyEncrypted,
      baseUrl: schema.apiProviders.baseUrl,
    })
    .from(schema.aiModels)
    .innerJoin(schema.apiProviders, eq(schema.aiModels.providerId, schema.apiProviders.id))
    .where(
      and(
        eq(schema.aiModels.orgId, orgId),
        eq(schema.aiModels.isDefault, true),
        eq(schema.aiModels.isActive, true),
        eq(schema.apiProviders.isActive, true),
      ),
    )
    .limit(1);

  if (defaultModels.length > 0) {
    const dm = defaultModels[0]!;
    try {
      const apiKey = dm.apiKeyEncrypted
        ? decryptApiKey(dm.apiKeyEncrypted)
        : undefined;

      const providerType = dm.providerType as ProviderType;
      const model = createProviderModel(
        providerType,
        dm.modelIdentifier,
        apiKey,
        dm.baseUrl ?? undefined,
      );

      logger.info("Resolved default model", {
        modelId: dm.modelIdentifier,
        provider: dm.providerName,
      });

      return {
        model,
        modelId: dm.modelIdentifier,
        displayName: dm.displayName,
        providerId: dm.providerId,
        providerType,
        providerName: dm.providerName,
        aiModelId: dm.modelId,
        costPer1kInput: dm.costPer1kInput ?? 0,
        costPer1kOutput: dm.costPer1kOutput ?? 0,
        maxTokens: dm.maxTokens ?? 4096,
      };
    } catch (err) {
      logger.warn("Failed to create default model provider", {
        modelId: dm.modelIdentifier,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 3. Fallback to environment variables (backward compatibility)
  // Primary: Google (GOOGLE_GENERATIVE_AI_API_KEY), Secondary: Anthropic (ANTHROPIC_API_KEY)
  const envModel = process.env["AI_MODEL"] ?? "gemini-3-flash-preview";
  const googleKey = process.env["GOOGLE_GENERATIVE_AI_API_KEY"];
  const anthropicKey = process.env["ANTHROPIC_API_KEY"];

  if (!googleKey && !anthropicKey) {
    throw new Error("No AI model configured and no API keys set (GOOGLE_GENERATIVE_AI_API_KEY or ANTHROPIC_API_KEY)");
  }

  // Determine provider based on model name or available key
  const isGoogleModel = envModel.startsWith("gemini");
  const useGoogle = isGoogleModel && googleKey;

  const fallbackProviderSlug = useGoogle ? "google" : "anthropic";
  const fallbackProviderName = useGoogle ? "Google AI" : "Anthropic";
  const fallbackProviderType: ProviderType = useGoogle ? "google" : "anthropic";

  logger.info("Falling back to env var model", {
    modelId: envModel,
    provider: fallbackProviderName,
  });

  // Find provider record for cost tracking
  const providers = await db
    .select()
    .from(schema.apiProviders)
    .where(eq(schema.apiProviders.slug, fallbackProviderSlug))
    .limit(1);

  const providerId = providers[0]?.id ?? "";

  const fallbackModel = useGoogle
    ? google(envModel)
    : anthropic(envModel);

  return {
    model: fallbackModel,
    modelId: envModel,
    displayName: envModel,
    providerId,
    providerType: fallbackProviderType,
    providerName: fallbackProviderName,
    aiModelId: null,
    costPer1kInput: useGoogle ? 0.0005 : 0.003,
    costPer1kOutput: useGoogle ? 0.003 : 0.015,
    maxTokens: Number(process.env["AI_MAX_TOKENS"] ?? "4096"),
  };
}
