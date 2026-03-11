"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function revokeSession(sessionId: string): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin) {
    return { success: false, error: "No autorizado" };
  }

  const db = getDb();

  try {
    await db
      .delete(schema.refreshTokens)
      .where(eq(schema.refreshTokens.id, sessionId));

    const org = await db.select().from(schema.organizations).limit(1);
    if (org[0]) {
      await db.insert(schema.activityLogs).values({
        orgId: org[0].id,
        userId: currentUser.id,
        action: "session.revoke",
        entityType: "refresh_token",
        entityId: sessionId,
      });
    }

    revalidatePath("/admin/sessions");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: message };
  }
}

export async function revokeAllUserSessions(
  targetUserId: string,
): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin) {
    return { success: false, error: "No autorizado" };
  }

  const db = getDb();

  try {
    await db
      .delete(schema.refreshTokens)
      .where(eq(schema.refreshTokens.userId, targetUserId));

    const org = await db.select().from(schema.organizations).limit(1);
    if (org[0]) {
      await db.insert(schema.activityLogs).values({
        orgId: org[0].id,
        userId: currentUser.id,
        action: "session.revoke-all",
        entityType: "user",
        entityId: targetUserId,
      });
    }

    revalidatePath("/admin/sessions");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: message };
  }
}
