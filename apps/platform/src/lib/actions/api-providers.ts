"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { encryptApiKey } from "@chs-platform/auth/crypto";
import { createLogger } from "@/lib/logger";

const logger = createLogger("actions:api-providers");

const providerSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  providerType: z.enum(["anthropic", "openai", "google", "xai"]).default("anthropic"),
  model: z.string().optional(),
  baseUrl: z.string().optional(),
  costPer1kInput: z.number().min(0).optional(),
  costPer1kOutput: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function createApiProvider(
  formData: FormData,
): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin)
    return { success: false, error: "No autorizado" };

  const parsed = providerSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    providerType: formData.get("providerType") || "anthropic",
    model: formData.get("model") || undefined,
    baseUrl: formData.get("baseUrl") || undefined,
    costPer1kInput: formData.get("costPer1kInput")
      ? Number(formData.get("costPer1kInput"))
      : undefined,
    costPer1kOutput: formData.get("costPer1kOutput")
      ? Number(formData.get("costPer1kOutput"))
      : undefined,
    isActive: formData.get("isActive") !== "false",
  });

  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };

  const db = getDb();
  const orgs = await db.select().from(schema.organizations).limit(1);
  const orgId = orgs[0]?.id;
  if (!orgId) return { success: false, error: "Organización no encontrada" };

  // Encrypt API key if provided
  const rawApiKey = formData.get("apiKey") as string | null;
  let apiKeyEncrypted: string | undefined;
  if (rawApiKey && rawApiKey.trim().length > 0) {
    try {
      apiKeyEncrypted = encryptApiKey(rawApiKey.trim());
    } catch (err) {
      logger.error("Failed to encrypt API key", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false, error: "Error al cifrar la API key. Verifique ENCRYPTION_KEY." };
    }
  }

  try {
    // A provider without an API key cannot be active
    const isActive = apiKeyEncrypted ? (parsed.data.isActive ?? true) : false;

    await db.insert(schema.apiProviders).values({
      ...parsed.data,
      isActive,
      orgId,
      apiKeyEncrypted,
    });

    await db.insert(schema.activityLogs).values({
      orgId,
      userId: currentUser.id,
      action: "api-provider.create",
      entityType: "api_provider",
      details: { name: parsed.data.name, providerType: parsed.data.providerType },
    });

    revalidatePath("/admin/api-providers");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    return {
      success: false,
      error: msg.includes("unique") ? "El slug ya existe" : msg,
    };
  }
}

export async function updateApiProvider(
  formData: FormData,
): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin)
    return { success: false, error: "No autorizado" };

  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID requerido" };

  const parsed = providerSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    providerType: formData.get("providerType") || "anthropic",
    model: formData.get("model") || undefined,
    baseUrl: formData.get("baseUrl") || undefined,
    costPer1kInput: formData.get("costPer1kInput")
      ? Number(formData.get("costPer1kInput"))
      : undefined,
    costPer1kOutput: formData.get("costPer1kOutput")
      ? Number(formData.get("costPer1kOutput"))
      : undefined,
    isActive: formData.get("isActive") !== "false",
  });

  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };

  // Encrypt API key if provided (empty = don't change)
  const rawApiKey = formData.get("apiKey") as string | null;
  let apiKeyEncrypted: string | undefined;
  if (rawApiKey && rawApiKey.trim().length > 0) {
    try {
      apiKeyEncrypted = encryptApiKey(rawApiKey.trim());
    } catch (err) {
      logger.error("Failed to encrypt API key", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false, error: "Error al cifrar la API key. Verifique ENCRYPTION_KEY." };
    }
  }

  const db = getDb();
  try {
    const updateData: Record<string, unknown> = { ...parsed.data };
    if (apiKeyEncrypted) {
      updateData.apiKeyEncrypted = apiKeyEncrypted;
    }

    // If no new API key provided, check if existing key is set
    if (!apiKeyEncrypted) {
      const existing = await db.select({ key: schema.apiProviders.apiKeyEncrypted })
        .from(schema.apiProviders).where(eq(schema.apiProviders.id, id)).limit(1);
      if (!existing[0]?.key) {
        updateData.isActive = false;
      }
    }

    await db
      .update(schema.apiProviders)
      .set(updateData)
      .where(eq(schema.apiProviders.id, id));

    revalidatePath("/admin/api-providers");
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error",
    };
  }
}

export async function deleteApiProvider(
  providerId: string,
): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin)
    return { success: false, error: "No autorizado" };

  const db = getDb();

  try {
    const providers = await db
      .select()
      .from(schema.apiProviders)
      .where(eq(schema.apiProviders.id, providerId))
      .limit(1);
    const provider = providers[0];
    if (!provider) return { success: false, error: "Proveedor no encontrado" };

    // Check if any AI models reference this provider
    const models = await db
      .select()
      .from(schema.aiModels)
      .where(eq(schema.aiModels.providerId, providerId))
      .limit(1);

    if (models.length > 0) {
      return {
        success: false,
        error: "No se puede eliminar: tiene modelos asignados",
      };
    }

    await db
      .delete(schema.apiProviders)
      .where(eq(schema.apiProviders.id, providerId));

    const orgs = await db.select().from(schema.organizations).limit(1);
    if (orgs[0]) {
      await db.insert(schema.activityLogs).values({
        orgId: orgs[0].id,
        userId: currentUser.id,
        action: "api-provider.delete",
        entityType: "api_provider",
        entityId: providerId,
        details: { name: provider.name },
      });
    }

    revalidatePath("/admin/api-providers");
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}
