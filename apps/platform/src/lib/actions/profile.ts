"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hashPassword } from "@chs-platform/auth";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import bcryptjs from "bcryptjs";

const updateProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8),
});

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function updateProfile(
  formData: FormData,
): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "No autorizado" };

  const parsed = updateProfileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
  });

  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };

  const db = getDb();
  try {
    await db
      .update(schema.users)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(schema.users.id, currentUser.id));
    revalidatePath("/profile");
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error",
    };
  }
}

export async function changePassword(
  formData: FormData,
): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "No autorizado" };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };

  if (parsed.data.newPassword !== parsed.data.confirmPassword) {
    return { success: false, error: "Las contraseñas no coinciden" };
  }

  const db = getDb();

  const usersFound = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, currentUser.id))
    .limit(1);
  const user = usersFound[0];
  if (!user) return { success: false, error: "Usuario no encontrado" };

  const isValid = bcryptjs.compareSync(
    parsed.data.currentPassword,
    user.passwordHash,
  );
  if (!isValid) return { success: false, error: "Contraseña actual incorrecta" };

  const newHash = await hashPassword(parsed.data.newPassword);
  await db
    .update(schema.users)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(schema.users.id, currentUser.id));

  revalidatePath("/profile");
  return { success: true };
}
