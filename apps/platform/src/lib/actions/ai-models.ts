"use server";

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const logger = createLogger("actions:ai-models");

const modelSchema = z.object({
  providerId: z.string().uuid(),
  modelId: z.string().min(1),
  displayName: z.string().min(1),
  costPer1kInput: z.number().min(0).default(0),
  costPer1kOutput: z.number().min(0).default(0),
  maxTokens: z.number().int().min(1).default(4096),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

const assignmentSchema = z.object({
  appId: z.string().uuid().nullable(),
  modelId: z.string().uuid(),
  priority: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function createAiModel(formData: FormData): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin)
    return { success: false, error: "No autorizado" };

  const parsed = modelSchema.safeParse({
    providerId: formData.get("providerId"),
    modelId: formData.get("modelId"),
    displayName: formData.get("displayName"),
    costPer1kInput: Number(formData.get("costPer1kInput") ?? 0),
    costPer1kOutput: Number(formData.get("costPer1kOutput") ?? 0),
    maxTokens: Number(formData.get("maxTokens") ?? 4096),
    isActive: formData.get("isActive") !== "false",
    isDefault: formData.get("isDefault") === "true",
  });

  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const db = getDb();
  const orgs = await db.select().from(schema.organizations).limit(1);
  const orgId = orgs[0]?.id;
  if (!orgId) return { success: false, error: "Organización no encontrada" };

  try {
    // If setting as default, unset other defaults
    if (parsed.data.isDefault) {
      await db
        .update(schema.aiModels)
        .set({ isDefault: false })
        .where(and(eq(schema.aiModels.orgId, orgId), eq(schema.aiModels.isDefault, true)));
    }

    await db.insert(schema.aiModels).values({
      ...parsed.data,
      orgId,
    });

    await db.insert(schema.activityLogs).values({
      orgId,
      userId: currentUser.id,
      action: "ai-model.create",
      entityType: "ai_model",
      details: { modelId: parsed.data.modelId, displayName: parsed.data.displayName },
    });

    revalidatePath("/admin/ai-models");
    return { success: true };
  } catch (err: unknown) {
    logger.error("Failed to create AI model", { error: err instanceof Error ? err.message : String(err) });
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function updateAiModel(formData: FormData): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin)
    return { success: false, error: "No autorizado" };

  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID requerido" };

  const parsed = modelSchema.safeParse({
    providerId: formData.get("providerId"),
    modelId: formData.get("modelId"),
    displayName: formData.get("displayName"),
    costPer1kInput: Number(formData.get("costPer1kInput") ?? 0),
    costPer1kOutput: Number(formData.get("costPer1kOutput") ?? 0),
    maxTokens: Number(formData.get("maxTokens") ?? 4096),
    isActive: formData.get("isActive") !== "false",
    isDefault: formData.get("isDefault") === "true",
  });

  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const db = getDb();

  try {
    // If setting as default, unset other defaults
    if (parsed.data.isDefault) {
      const model = await db.select().from(schema.aiModels).where(eq(schema.aiModels.id, id)).limit(1);
      const orgId = model[0]?.orgId;
      if (orgId) {
        await db
          .update(schema.aiModels)
          .set({ isDefault: false })
          .where(and(eq(schema.aiModels.orgId, orgId), eq(schema.aiModels.isDefault, true)));
      }
    }

    await db.update(schema.aiModels).set(parsed.data).where(eq(schema.aiModels.id, id));

    revalidatePath("/admin/ai-models");
    return { success: true };
  } catch (err: unknown) {
    logger.error("Failed to update AI model", { error: err instanceof Error ? err.message : String(err) });
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function deleteAiModel(id: string): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin)
    return { success: false, error: "No autorizado" };

  const db = getDb();
  try {
    await db.delete(schema.aiModels).where(eq(schema.aiModels.id, id));
    revalidatePath("/admin/ai-models");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function createModelAssignment(formData: FormData): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin)
    return { success: false, error: "No autorizado" };

  const parsed = assignmentSchema.safeParse({
    appId: formData.get("appId") || null,
    modelId: formData.get("modelId"),
    priority: Number(formData.get("priority") ?? 0),
    isActive: formData.get("isActive") !== "false",
  });

  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const db = getDb();
  try {
    await db.insert(schema.appModelAssignments).values(parsed.data);
    revalidatePath("/admin/ai-models");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function deleteModelAssignment(id: string): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin)
    return { success: false, error: "No autorizado" };

  const db = getDb();
  try {
    await db.delete(schema.appModelAssignments).where(eq(schema.appModelAssignments.id, id));
    revalidatePath("/admin/ai-models");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}
