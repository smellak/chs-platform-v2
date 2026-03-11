"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const appSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  category: z.string().optional(),
  version: z.string().optional(),
  isActive: z.boolean().optional(),
  isMaintenance: z.boolean().optional(),
});

const instanceSchema = z.object({
  internalUrl: z.string().optional(),
  externalDomain: z.string().optional(),
  healthEndpoint: z.string().optional(),
  publicPaths: z.string().optional(),
});

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function createApp(formData: FormData): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const parsed = appSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || undefined,
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
    category: formData.get("category") || undefined,
    version: formData.get("version") || "1.0",
    isActive: formData.get("isActive") !== "false",
    isMaintenance: formData.get("isMaintenance") === "true",
  });

  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const db = getDb();
  const orgs = await db.select().from(schema.organizations).limit(1);
  const orgId = orgs[0]?.id;
  if (!orgId) return { success: false, error: "Organización no encontrada" };

  try {
    const [app] = await db.insert(schema.apps).values({ ...parsed.data, orgId }).returning();
    if (!app) return { success: false, error: "Error creando app" };

    // Create instance if URL provided
    const internalUrl = formData.get("internalUrl") as string | null;
    if (internalUrl) {
      const publicPathsRaw = (formData.get("publicPaths") as string | null) ?? "";
      const publicPaths = publicPathsRaw.split("\n").map((p) => p.trim()).filter(Boolean);

      await db.insert(schema.appInstances).values({
        appId: app.id,
        internalUrl,
        externalDomain: (formData.get("externalDomain") as string | null) ?? undefined,
        healthEndpoint: (formData.get("healthEndpoint") as string | null) ?? "/api/health",
        publicPaths,
      });
    }

    // Handle access policies (de-duplicated batch insert)
    const accessEntries = formData.getAll("access");
    const uniqueCreateEntries = new Map<string, string>();
    for (const entry of accessEntries) {
      const [deptId, level] = String(entry).split(":");
      if (deptId && level) {
        uniqueCreateEntries.set(deptId, level);
      }
    }
    if (uniqueCreateEntries.size > 0) {
      await db.insert(schema.appAccessPolicies).values(
        Array.from(uniqueCreateEntries.entries()).map(([deptId, level]) => ({
          appId: app.id,
          departmentId: deptId,
          accessLevel: level,
        })),
      );
    }

    // Handle agent registration
    const agentEnabled = formData.get("agentEnabled") === "true";
    if (agentEnabled) {
      const agentName = (formData.get("agentName") as string) ?? "";
      const agentDescription = (formData.get("agentDescription") as string) ?? "";
      const agentEndpoint = (formData.get("agentEndpoint") as string) ?? "";
      const capabilitiesRaw = (formData.get("agentCapabilities") as string) ?? "[]";
      const rawCapabilities = JSON.parse(capabilitiesRaw) as Array<{
        name: string;
        description: string;
        parameters: Array<{ name: string; type: string; required: boolean; description: string; enumValues?: string[] }>;
      }>;
      const capabilities = rawCapabilities.map((cap) => ({
        name: cap.name,
        description: cap.description,
        requiredPermission: "",
        parameters: Object.fromEntries(
          cap.parameters.map((p) => [p.name, { type: p.type, required: p.required, description: p.description, enumValues: p.enumValues }]),
        ) as Record<string, unknown>,
      }));

      await db.insert(schema.appAgents).values({
        appId: app.id,
        name: agentName,
        description: agentDescription,
        endpoint: agentEndpoint,
        capabilities,
        isActive: true,
      });
    }

    await db.insert(schema.activityLogs).values({
      orgId, userId: currentUser.id, action: "app.create",
      entityType: "app", entityId: app.id, details: { name: app.name },
    });

    revalidatePath("/admin/apps");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    return { success: false, error: msg.includes("unique") ? "El slug ya existe" : msg };
  }
}

export async function updateApp(formData: FormData): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID requerido" };

  const parsed = appSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || undefined,
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
    category: formData.get("category") || undefined,
    version: formData.get("version") || undefined,
    isActive: formData.get("isActive") !== "false",
    isMaintenance: formData.get("isMaintenance") === "true",
  });

  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const db = getDb();

  try {
    await db.update(schema.apps).set({ ...parsed.data, updatedAt: new Date() }).where(eq(schema.apps.id, id));

    // Update instance
    const internalUrl = formData.get("internalUrl") as string | null;
    if (internalUrl) {
      const publicPathsRaw = (formData.get("publicPaths") as string | null) ?? "";
      const publicPaths = publicPathsRaw.split("\n").map((p) => p.trim()).filter(Boolean);

      const existing = await db.select().from(schema.appInstances).where(eq(schema.appInstances.appId, id)).limit(1);
      if (existing[0]) {
        await db.update(schema.appInstances).set({
          internalUrl,
          externalDomain: (formData.get("externalDomain") as string | null) ?? undefined,
          healthEndpoint: (formData.get("healthEndpoint") as string | null) ?? "/api/health",
          publicPaths,
        }).where(eq(schema.appInstances.appId, id));
      } else {
        await db.insert(schema.appInstances).values({
          appId: id, internalUrl,
          externalDomain: (formData.get("externalDomain") as string | null) ?? undefined,
          healthEndpoint: (formData.get("healthEndpoint") as string | null) ?? "/api/health",
          publicPaths,
        });
      }
    }

    // Rebuild access policies (only if the access tab was part of this submission)
    const accessManaged = formData.get("accessManaged") === "true";
    if (accessManaged) {
      const accessEntries = formData.getAll("access");
      const uniqueEntries = new Map<string, string>();
      for (const entry of accessEntries) {
        const [deptId, level] = String(entry).split(":");
        if (deptId && level) {
          uniqueEntries.set(deptId, level);
        }
      }
      await db.transaction(async (tx) => {
        await tx.delete(schema.appAccessPolicies).where(eq(schema.appAccessPolicies.appId, id));
        if (uniqueEntries.size > 0) {
          await tx.insert(schema.appAccessPolicies).values(
            Array.from(uniqueEntries.entries()).map(([deptId, level]) => ({
              appId: id,
              departmentId: deptId,
              accessLevel: level,
            })),
          );
        }
      });
    }

    // Handle agent registration
    const agentEnabled = formData.get("agentEnabled") === "true";
    const existingAgent = await db.select().from(schema.appAgents).where(eq(schema.appAgents.appId, id)).limit(1);

    if (agentEnabled) {
      const agentName = (formData.get("agentName") as string) ?? "";
      const agentDescription = (formData.get("agentDescription") as string) ?? "";
      const agentEndpoint = (formData.get("agentEndpoint") as string) ?? "";
      const capabilitiesRaw = (formData.get("agentCapabilities") as string) ?? "[]";
      const rawCapabilities = JSON.parse(capabilitiesRaw) as Array<{
        name: string;
        description: string;
        parameters: Array<{ name: string; type: string; required: boolean; description: string; enumValues?: string[] }>;
      }>;
      const capabilities = rawCapabilities.map((cap) => ({
        name: cap.name,
        description: cap.description,
        requiredPermission: "",
        parameters: Object.fromEntries(
          cap.parameters.map((p) => [p.name, { type: p.type, required: p.required, description: p.description, enumValues: p.enumValues }]),
        ) as Record<string, unknown>,
      }));

      if (existingAgent[0]) {
        await db.update(schema.appAgents).set({
          name: agentName,
          description: agentDescription,
          endpoint: agentEndpoint,
          capabilities,
          isActive: true,
        }).where(eq(schema.appAgents.appId, id));
      } else {
        await db.insert(schema.appAgents).values({
          appId: id,
          name: agentName,
          description: agentDescription,
          endpoint: agentEndpoint,
          capabilities,
          isActive: true,
        });
      }
    } else if (existingAgent[0]) {
      await db.update(schema.appAgents).set({ isActive: false }).where(eq(schema.appAgents.appId, id));
    }

    // Check if app was put in maintenance and notify
    if (parsed.data.isMaintenance) {
      const orgs = await db.select().from(schema.organizations).limit(1);
      if (orgs[0]) {
        await db.insert(schema.notifications).values({
          orgId: orgs[0].id,
          title: "App en mantenimiento",
          message: `${parsed.data.name} ha sido puesta en mantenimiento`,
          type: "warning",
        });
      }
    }

    revalidatePath("/admin/apps");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function deleteApp(appId: string): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const db = getDb();

  try {
    const apps = await db.select().from(schema.apps).where(eq(schema.apps.id, appId)).limit(1);
    const app = apps[0];
    if (!app) return { success: false, error: "Aplicación no encontrada" };

    // CASCADE in schema handles appInstances, appAccessPolicies, appAgents
    await db.delete(schema.apps).where(eq(schema.apps.id, appId));

    // Log activity
    const org = await db.select().from(schema.organizations).limit(1);
    if (org[0]) {
      await db.insert(schema.activityLogs).values({
        orgId: org[0].id,
        userId: currentUser.id,
        action: "app.delete",
        entityType: "app",
        entityId: appId,
        details: { name: app.name, slug: app.slug },
      });
    }

    revalidatePath("/admin/apps");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: message };
  }
}
