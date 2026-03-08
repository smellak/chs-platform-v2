"use server";

import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hashPassword } from "@chs-platform/auth";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const createUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8),
  departmentId: z.string().uuid().optional(),
  roleId: z.string().uuid().optional(),
  isSuperAdmin: z.boolean().optional(),
});

const updateUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  password: z.string().min(8).optional(),
  departmentId: z.string().uuid().optional(),
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
});

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function createUser(formData: FormData): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin) {
    return { success: false, error: "No autorizado" };
  }

  const raw = {
    username: formData.get("username"),
    email: formData.get("email"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    password: formData.get("password"),
    departmentId: formData.get("departmentId") || undefined,
    roleId: formData.get("roleId") || undefined,
    isSuperAdmin: formData.get("isSuperAdmin") === "true",
  };

  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getDb();
  const { password, departmentId, roleId, ...userData } = parsed.data;

  try {
    const passwordHash = await hashPassword(password);
    const [newUser] = await db
      .insert(schema.users)
      .values({
        ...userData,
        orgId: currentUser.departments[0]?.departmentId
          ? (await db.select().from(schema.departments).where(eq(schema.departments.id, currentUser.departments[0].departmentId)).limit(1))[0]?.orgId ?? currentUser.id
          : currentUser.id,
        passwordHash,
        isActive: true,
      })
      .returning();

    if (newUser && departmentId && roleId) {
      await db.insert(schema.userDepartmentRoles).values({
        userId: newUser.id,
        departmentId,
        roleId,
      });
    }

    // Log activity
    if (newUser) {
      const org = await db.select().from(schema.organizations).limit(1);
      if (org[0]) {
        await db.insert(schema.activityLogs).values({
          orgId: org[0].id,
          userId: currentUser.id,
          action: "user.create",
          entityType: "user",
          entityId: newUser.id,
          details: { username: newUser.username },
        });

        // Create notification for admins
        await db.insert(schema.notifications).values({
          orgId: org[0].id,
          title: "Nuevo usuario creado",
          message: `Se ha creado el usuario ${newUser.username}`,
          type: "info",
        });
      }
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    if (message.includes("unique") || message.includes("duplicate")) {
      return { success: false, error: "El username o email ya existe" };
    }
    return { success: false, error: message };
  }
}

export async function updateUser(formData: FormData): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin) {
    return { success: false, error: "No autorizado" };
  }

  const raw = {
    id: formData.get("id"),
    username: formData.get("username") || undefined,
    email: formData.get("email") || undefined,
    firstName: formData.get("firstName") || undefined,
    lastName: formData.get("lastName") || undefined,
    password: formData.get("password") || undefined,
    departmentId: formData.get("departmentId") || undefined,
    roleId: formData.get("roleId") || undefined,
    isActive: formData.has("isActive") ? formData.get("isActive") === "true" : undefined,
    isSuperAdmin: formData.has("isSuperAdmin") ? formData.get("isSuperAdmin") === "true" : undefined,
  };

  const parsed = updateUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getDb();
  const { id, password, departmentId, roleId, ...updates } = parsed.data;

  try {
    const updateData: Record<string, unknown> = { ...updates, updatedAt: new Date() };
    if (password) {
      updateData["passwordHash"] = await hashPassword(password);
    }

    await db.update(schema.users).set(updateData).where(eq(schema.users.id, id));

    if (departmentId && roleId) {
      await db.delete(schema.userDepartmentRoles).where(eq(schema.userDepartmentRoles.userId, id));
      await db.insert(schema.userDepartmentRoles).values({ userId: id, departmentId, roleId });
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: message };
  }
}

export async function toggleUserActive(userId: string): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin) {
    return { success: false, error: "No autorizado" };
  }

  if (userId === currentUser.id) {
    return { success: false, error: "No puedes desactivarte a ti mismo" };
  }

  const db = getDb();

  const users = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const user = users[0];
  if (!user) return { success: false, error: "Usuario no encontrado" };

  // Prevent deactivating last super admin
  if (user.isSuperAdmin && user.isActive) {
    const adminCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .where(and(eq(schema.users.isSuperAdmin, true), eq(schema.users.isActive, true)));
    if ((adminCount[0]?.count ?? 0) <= 1) {
      return { success: false, error: "No puedes desactivar al último super admin" };
    }
  }

  await db.update(schema.users).set({ isActive: !user.isActive }).where(eq(schema.users.id, userId));

  revalidatePath("/admin/users");
  return { success: true };
}
