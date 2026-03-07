"use server";

import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function getNotifications() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  const db = getDb();
  const orgs = await db.select().from(schema.organizations).limit(1);
  const orgId = orgs[0]?.id;
  if (!orgId) return [];

  return db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.orgId, orgId))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(20);
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "No autorizado" };

  const db = getDb();
  await db
    .update(schema.notifications)
    .set({ isRead: true })
    .where(eq(schema.notifications.id, id));

  revalidatePath("/");
  return { success: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: "No autorizado" };

  const db = getDb();
  const orgs = await db.select().from(schema.organizations).limit(1);
  const orgId = orgs[0]?.id;
  if (!orgId) return { success: false, error: "Organización no encontrada" };

  await db
    .update(schema.notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(schema.notifications.orgId, orgId),
        eq(schema.notifications.isRead, false),
      ),
    );

  revalidatePath("/");
  return { success: true };
}
