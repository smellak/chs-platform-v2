"use server";

import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { TraefikManager } from "@/lib/traefik-manager";

interface TraefikResult {
  success: boolean;
  yaml?: string;
  error?: string;
}

interface ConnectivityResult {
  status: number;
  responseMs: number;
  error?: string;
}

async function getAppInstance(appId: string) {
  const db = getDb();
  const results = await db
    .select({
      instanceId: schema.appInstances.id,
      appId: schema.appInstances.appId,
      internalUrl: schema.appInstances.internalUrl,
      externalDomain: schema.appInstances.externalDomain,
      healthEndpoint: schema.appInstances.healthEndpoint,
      publicPaths: schema.appInstances.publicPaths,
      appName: schema.apps.name,
      appSlug: schema.apps.slug,
    })
    .from(schema.appInstances)
    .innerJoin(schema.apps, eq(schema.appInstances.appId, schema.apps.id))
    .where(eq(schema.appInstances.appId, appId))
    .limit(1);

  return results[0] ?? null;
}

export async function previewTraefikConfig(appId: string): Promise<TraefikResult> {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const instance = await getAppInstance(appId);
  if (!instance) return { success: false, error: "Instancia no encontrada" };
  if (!instance.externalDomain) return { success: false, error: "Dominio externo no configurado" };

  const manager = new TraefikManager();
  const alephVerifyUrl = TraefikManager.resolveAlephVerifyUrl();

  const yaml = manager.generateYaml({
    appSlug: instance.appSlug,
    appName: instance.appName,
    externalDomain: instance.externalDomain,
    internalUrl: instance.internalUrl,
    publicPaths: (instance.publicPaths ?? []) as string[],
    alephVerifyUrl,
  });

  return { success: true, yaml };
}

export async function applyTraefikConfig(appId: string): Promise<TraefikResult> {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const instance = await getAppInstance(appId);
  if (!instance) return { success: false, error: "Instancia no encontrada" };
  if (!instance.externalDomain) return { success: false, error: "Dominio externo no configurado" };

  const manager = new TraefikManager();
  const alephVerifyUrl = TraefikManager.resolveAlephVerifyUrl();

  try {
    const yaml = await manager.generateConfig({
      appSlug: instance.appSlug,
      appName: instance.appName,
      externalDomain: instance.externalDomain,
      internalUrl: instance.internalUrl,
      publicPaths: (instance.publicPaths ?? []) as string[],
      alephVerifyUrl,
    });

    // Update instance with config path
    const db = getDb();
    await db
      .update(schema.appInstances)
      .set({ traefikConfigPath: manager.getConfigPath(instance.appSlug) })
      .where(eq(schema.appInstances.id, instance.instanceId));

    await db.insert(schema.activityLogs).values({
      orgId: user.departments[0]?.departmentId ? user.orgId : user.orgId,
      userId: user.id,
      action: "traefik.config.applied",
      entityType: "app",
      entityId: appId,
      details: { appSlug: instance.appSlug, domain: instance.externalDomain },
    });

    return { success: true, yaml };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error aplicando configuración" };
  }
}

export async function removeTraefikConfig(appId: string): Promise<TraefikResult> {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) return { success: false, error: "No autorizado" };

  const instance = await getAppInstance(appId);
  if (!instance) return { success: false, error: "Instancia no encontrada" };

  const manager = new TraefikManager();

  try {
    await manager.removeConfig(instance.appSlug);

    const db = getDb();
    await db
      .update(schema.appInstances)
      .set({ traefikConfigPath: null })
      .where(eq(schema.appInstances.id, instance.instanceId));

    await db.insert(schema.activityLogs).values({
      orgId: user.orgId,
      userId: user.id,
      action: "traefik.config.removed",
      entityType: "app",
      entityId: appId,
      details: { appSlug: instance.appSlug },
    });

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error eliminando configuración" };
  }
}

export async function checkAppConnectivity(appId: string): Promise<ConnectivityResult> {
  const user = await getCurrentUser();
  if (!user?.isSuperAdmin) return { status: 0, responseMs: 0, error: "No autorizado" };

  const instance = await getAppInstance(appId);
  if (!instance) return { status: 0, responseMs: 0, error: "Instancia no encontrada" };

  const endpoint = instance.healthEndpoint ?? "/api/health";
  const url = `${instance.internalUrl.replace(/\/$/, "")}${endpoint}`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Aleph-ConnCheck/0.1" },
    });

    clearTimeout(timeout);
    return { status: res.status, responseMs: Date.now() - start };
  } catch {
    return { status: 0, responseMs: Date.now() - start, error: "Conexión fallida o timeout" };
  }
}
