"use server";

import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const departmentSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function createDepartment(formData: FormData): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const parsed = departmentSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || undefined,
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
  });

  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const db = getDb();
  const orgs = await db.select().from(schema.organizations).limit(1);
  const orgId = orgs[0]?.id;
  if (!orgId) return { success: false, error: "Organización no encontrada" };

  try {
    await db.insert(schema.departments).values({ ...parsed.data, orgId });
    await db.insert(schema.activityLogs).values({
      orgId, userId: currentUser.id, action: "department.create",
      entityType: "department", details: { name: parsed.data.name },
    });
    revalidatePath("/admin/departments");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    return { success: false, error: msg.includes("unique") ? "El slug ya existe" : msg };
  }
}

export async function updateDepartment(formData: FormData): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID requerido" };

  const parsed = departmentSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || undefined,
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
  });

  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const db = getDb();
  try {
    await db.update(schema.departments).set(parsed.data).where(eq(schema.departments.id, id));
    revalidatePath("/admin/departments");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function deleteDepartment(id: string): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const db = getDb();

  // Check if department has users or apps
  const userCount = await db.select({ count: sql<number>`count(*)` })
    .from(schema.userDepartmentRoles).where(eq(schema.userDepartmentRoles.departmentId, id));
  const appCount = await db.select({ count: sql<number>`count(*)` })
    .from(schema.appAccessPolicies).where(eq(schema.appAccessPolicies.departmentId, id));

  if ((userCount[0]?.count ?? 0) > 0 || (appCount[0]?.count ?? 0) > 0) {
    return { success: false, error: "No se puede eliminar: tiene usuarios o apps asignadas" };
  }

  await db.delete(schema.departments).where(eq(schema.departments.id, id));
  revalidatePath("/admin/departments");
  return { success: true };
}
