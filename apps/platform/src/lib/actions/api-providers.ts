"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const providerSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  model: z.string().optional(),
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
    model: formData.get("model") || undefined,
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

  try {
    await db
      .insert(schema.apiProviders)
      .values({ ...parsed.data, orgId });
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
    model: formData.get("model") || undefined,
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
  try {
    await db
      .update(schema.apiProviders)
      .set(parsed.data)
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
