import { eq, and, asc } from "drizzle-orm";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { LanguageModelV1 } from "ai";
import { getDb, schema } from "@/lib/db";
import { decryptApiKey } from "@aleph/auth/crypto";
import { createLogger } from "@/lib/logger";

const logger = createLogger("model-resolver");

type ProviderType = "anthropic" | "openai" | "google" | "xai";

export interface ResolvedModel {
  model: LanguageModelV1;
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
): LanguageModelV1 {
  switch (providerType) {
    case "anthropic": {
      const opts = apiKey ? anthropic.languageModel(modelId, { headers: { "x-api-key": apiKey } }) : anthropic(modelId);
      return opts;
    }
    case "openai": {
      if (apiKey) {
        const customOpenai = openai.languageModel(modelId, { structuredOutputs: true });
        // For custom API keys, set via env override before call
        if (apiKey) process.env["OPENAI_API_KEY"] = apiKey;
        if (baseUrl) process.env["OPENAI_BASE_URL"] = baseUrl;
        return customOpenai;
      }
      return openai(modelId);
    }
    case "google": {
      if (apiKey) process.env["GOOGLE_GENERATIVE_AI_API_KEY"] = apiKey;
      return google(modelId);
    }
    case "xai": {
      // xAI uses OpenAI-compatible API
      if (apiKey) process.env["OPENAI_API_KEY"] = apiKey;
      process.env["OPENAI_BASE_URL"] = baseUrl ?? "https://api.x.ai/v1";
      return openai(modelId);
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
  const envModel = process.env["AI_MODEL"] ?? "claude-sonnet-4-20250514";
  const envApiKey = process.env["ANTHROPIC_API_KEY"];
  if (!envApiKey) {
    throw new Error("No AI model configured and ANTHROPIC_API_KEY not set");
  }

  logger.info("Falling back to env var model", { modelId: envModel });

  // Find or create provider record for cost tracking
  const providers = await db
    .select()
    .from(schema.apiProviders)
    .where(eq(schema.apiProviders.slug, "anthropic"))
    .limit(1);

  const providerId = providers[0]?.id ?? "";

  return {
    model: anthropic(envModel),
    modelId: envModel,
    displayName: envModel,
    providerId,
    providerType: "anthropic",
    providerName: "Anthropic",
    aiModelId: null,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    maxTokens: Number(process.env["AI_MAX_TOKENS"] ?? "4096"),
  };
}
