"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const roleSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
});

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function createRole(formData: FormData): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const permissionsRaw = formData.get("permissions") as string | null;
  let permissions: Record<string, boolean> = {};
  if (permissionsRaw) {
    try { permissions = JSON.parse(permissionsRaw) as Record<string, boolean>; } catch { /* empty */ }
  }

  const parsed = roleSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || undefined,
    permissions,
  });

  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const db = getDb();
  const orgs = await db.select().from(schema.organizations).limit(1);
  const orgId = orgs[0]?.id;
  if (!orgId) return { success: false, error: "Organización no encontrada" };

  try {
    await db.insert(schema.roles).values({ ...parsed.data, orgId, isSystem: false });
    revalidatePath("/admin/roles");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    return { success: false, error: msg.includes("unique") ? "El slug ya existe" : msg };
  }
}

export async function updateRole(formData: FormData): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID requerido" };

  const permissionsRaw = formData.get("permissions") as string | null;
  let permissions: Record<string, boolean> = {};
  if (permissionsRaw) {
    try { permissions = JSON.parse(permissionsRaw) as Record<string, boolean>; } catch { /* empty */ }
  }

  const parsed = roleSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || undefined,
    permissions,
  });

  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const db = getDb();
  try {
    await db.update(schema.roles).set(parsed.data).where(eq(schema.roles.id, id));
    revalidatePath("/admin/roles");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function deleteRole(roleId: string): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const db = getDb();

  try {
    const roles = await db.select().from(schema.roles).where(eq(schema.roles.id, roleId)).limit(1);
    const role = roles[0];
    if (!role) return { success: false, error: "Rol no encontrado" };

    if (role.isSystem) {
      return { success: false, error: "No se puede eliminar un rol del sistema" };
    }

    // Check if any users are assigned to this role
    const assignments = await db
      .select()
      .from(schema.userDepartmentRoles)
      .where(eq(schema.userDepartmentRoles.roleId, roleId))
      .limit(1);

    if (assignments.length > 0) {
      return { success: false, error: "No se puede eliminar: hay usuarios asignados a este rol" };
    }

    await db.delete(schema.roles).where(eq(schema.roles.id, roleId));

    revalidatePath("/admin/roles");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
