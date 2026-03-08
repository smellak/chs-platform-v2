"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const logger = createLogger("actions:ai-permissions");

const permissionSchema = z.object({
  targetType: z.enum(["department", "role", "user"]),
  targetId: z.string().uuid(),
  appId: z.string().uuid().nullable().optional(),
  canAccess: z.boolean().default(true),
  blockedTools: z.array(z.string()).default([]),
  allowedModels: z.array(z.string()).default([]),
  maxTokensPerDay: z.number().int().min(0).nullable().optional(),
  maxMessagesPerHour: z.number().int().min(0).nullable().optional(),
});

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function createAgentPermission(formData: FormData): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin)
    return { success: false, error: "No autorizado" };

  const blockedToolsRaw = formData.get("blockedTools") as string;
  const allowedModelsRaw = formData.get("allowedModels") as string;

  const parsed = permissionSchema.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    appId: formData.get("appId") || null,
    canAccess: formData.get("canAccess") !== "false",
    blockedTools: blockedToolsRaw ? blockedToolsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
    allowedModels: allowedModelsRaw ? allowedModelsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
    maxTokensPerDay: formData.get("maxTokensPerDay") ? Number(formData.get("maxTokensPerDay")) : null,
    maxMessagesPerHour: formData.get("maxMessagesPerHour") ? Number(formData.get("maxMessagesPerHour")) : null,
  });

  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const db = getDb();
  const orgs = await db.select().from(schema.organizations).limit(1);
  const orgId = orgs[0]?.id;
  if (!orgId) return { success: false, error: "Organización no encontrada" };

  try {
    await db.insert(schema.agentPermissions).values({
      ...parsed.data,
      orgId,
      createdBy: currentUser.id,
    });

    await db.insert(schema.activityLogs).values({
      orgId,
      userId: currentUser.id,
      action: "agent-permission.create",
      entityType: "agent_permission",
      details: {
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        canAccess: parsed.data.canAccess,
      },
    });

    revalidatePath("/admin/ai-permissions");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    logger.error("Failed to create permission", { error: msg });
    return {
      success: false,
      error: msg.includes("unique") ? "Ya existe una regla para este objetivo y app" : msg,
    };
  }
}

export async function updateAgentPermission(formData: FormData): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin)
    return { success: false, error: "No autorizado" };

  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID requerido" };

  const blockedToolsRaw = formData.get("blockedTools") as string;
  const allowedModelsRaw = formData.get("allowedModels") as string;

  const parsed = permissionSchema.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    appId: formData.get("appId") || null,
    canAccess: formData.get("canAccess") !== "false",
    blockedTools: blockedToolsRaw ? blockedToolsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
    allowedModels: allowedModelsRaw ? allowedModelsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
    maxTokensPerDay: formData.get("maxTokensPerDay") ? Number(formData.get("maxTokensPerDay")) : null,
    maxMessagesPerHour: formData.get("maxMessagesPerHour") ? Number(formData.get("maxMessagesPerHour")) : null,
  });

  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const db = getDb();
  try {
    await db
      .update(schema.agentPermissions)
      .set(parsed.data)
      .where(eq(schema.agentPermissions.id, id));

    revalidatePath("/admin/ai-permissions");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function deleteAgentPermission(id: string): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin)
    return { success: false, error: "No autorizado" };

  const db = getDb();
  try {
    await db.delete(schema.agentPermissions).where(eq(schema.agentPermissions.id, id));
    revalidatePath("/admin/ai-permissions");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}
