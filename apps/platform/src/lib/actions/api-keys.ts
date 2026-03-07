"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
});

interface ActionResult {
  success: boolean;
  error?: string;
  key?: string;
}

export async function createApiKey(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const parsed = createKeySchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const rawKey = `aleph_sk_${randomBytes(20).toString("hex")}`;
  const keyPrefix = rawKey.slice(0, 12);
  const keyHash = bcrypt.hashSync(rawKey, 10);

  const db = getDb();

  try {
    await db.insert(schema.apiKeys).values({
      orgId: user.orgId,
      name: parsed.data.name,
      keyHash,
      keyPrefix,
      createdBy: user.id,
    });

    await db.insert(schema.activityLogs).values({
      orgId: user.orgId,
      userId: user.id,
      action: "api-key.create",
      details: { name: parsed.data.name, prefix: keyPrefix },
    });

    revalidatePath("/admin/api-keys");
    return { success: true, key: rawKey };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function revokeApiKey(keyId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const db = getDb();

  try {
    await db
      .update(schema.apiKeys)
      .set({ isActive: false })
      .where(eq(schema.apiKeys.id, keyId));

    await db.insert(schema.activityLogs).values({
      orgId: user.orgId,
      userId: user.id,
      action: "api-key.revoke",
      entityType: "api-key",
      entityId: keyId,
    });

    revalidatePath("/admin/api-keys");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}
