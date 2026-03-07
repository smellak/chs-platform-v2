"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const webhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function createWebhook(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const eventsRaw = formData.getAll("events").map(String);

  const parsed = webhookSchema.safeParse({
    name: formData.get("name"),
    url: formData.get("url"),
    events: eventsRaw,
  });

  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const secret = randomBytes(32).toString("hex");
  const db = getDb();

  try {
    await db.insert(schema.webhooks).values({
      orgId: user.orgId,
      name: parsed.data.name,
      url: parsed.data.url,
      events: parsed.data.events,
      secret,
      createdBy: user.id,
    });

    await db.insert(schema.activityLogs).values({
      orgId: user.orgId,
      userId: user.id,
      action: "webhook.create",
      details: { name: parsed.data.name, events: parsed.data.events },
    });

    revalidatePath("/admin/webhooks");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function updateWebhook(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID requerido" };

  const eventsRaw = formData.getAll("events").map(String);

  const parsed = webhookSchema.safeParse({
    name: formData.get("name"),
    url: formData.get("url"),
    events: eventsRaw,
  });

  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const db = getDb();

  try {
    await db
      .update(schema.webhooks)
      .set({
        name: parsed.data.name,
        url: parsed.data.url,
        events: parsed.data.events,
      })
      .where(eq(schema.webhooks.id, id));

    revalidatePath("/admin/webhooks");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function toggleWebhook(id: string, isActive: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const db = getDb();

  try {
    await db
      .update(schema.webhooks)
      .set({ isActive })
      .where(eq(schema.webhooks.id, id));

    revalidatePath("/admin/webhooks");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function deleteWebhook(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const db = getDb();

  try {
    await db.delete(schema.webhooks).where(eq(schema.webhooks.id, id));

    await db.insert(schema.activityLogs).values({
      orgId: user.orgId,
      userId: user.id,
      action: "webhook.delete",
      entityType: "webhook",
      entityId: id,
    });

    revalidatePath("/admin/webhooks");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function testWebhook(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const db = getDb();
  const hooks = await db
    .select()
    .from(schema.webhooks)
    .where(eq(schema.webhooks.id, id))
    .limit(1);

  const hook = hooks[0];
  if (!hook) return { success: false, error: "Webhook no encontrado" };

  const payload = JSON.stringify({
    event: "test",
    timestamp: new Date().toISOString(),
    data: { message: "Test webhook from Aleph Platform" },
  });

  try {
    const { createHmac } = await import("crypto");
    const signature = createHmac("sha256", hook.secret).update(payload).digest("hex");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Aleph-Signature": signature,
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    await db
      .update(schema.webhooks)
      .set({
        lastTriggered: new Date(),
        lastStatus: res.status,
      })
      .where(eq(schema.webhooks.id, id));

    return { success: res.ok };
  } catch {
    return { success: false, error: "Conexión fallida o timeout" };
  }
}
